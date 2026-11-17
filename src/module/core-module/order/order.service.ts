import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OrderStatus, Prisma, TicketStatus } from '@prisma/client';
import type Redis from 'ioredis';
import { PrismaService } from '../infra/prisma/prisma.service';
import { MetricsService } from '../infra/metrics/metrics.service';
import { RedisLockService } from '../infra/redis/redis.lock.service';
import { REDIS_LOCK_CLIENT } from '../infra/redis/redis.value';
import { IDEMPOTENCY_KEYS, PAYMENT_LOCK_TTL_MS } from '../payment/constant';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { GetOrderDto } from './dto/get-order.dto';
import { GetOwnerOrderDto } from './dto/get-owner-order.dto';
import { ALLOWED_TRANSITIONS, PaymentOrder } from './type';
import { TicketService } from '../../theater-module/ticket/ticket.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisLockService: RedisLockService,
    @Inject(REDIS_LOCK_CLIENT) private readonly redis: Redis,
    private readonly ticketService: TicketService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  private normalizeIdempotencyKey(key?: string): string | null {
    if (!key) return null;
    const v = key.trim();
    if (!/^[A-Za-z0-9-_]{8,64}$/.test(v)) return null;
    return v;
  }

  async createOrder(
    dto: CreateOrderDto & { userId: string; idempotencyKey?: string },
  ): Promise<PaymentOrder> {
    try {
      const order = await this.doCreateOrder(dto);
      this.metrics?.incPaymentOrder('success');
      return order;
    } catch (error) {
      if (error instanceof ConflictException) {
        this.metrics?.incPaymentOrder('conflict');
      } else {
        this.metrics?.incPaymentOrder('error');
      }
      throw error;
    }
  }

  private async doCreateOrder(
    dto: CreateOrderDto & { userId: string; idempotencyKey?: string },
  ): Promise<PaymentOrder> {
    // Server-side idempotency key: use client key if provided, otherwise fall
    // back to ticketId so retries for the same ticket stay idempotent.
    const idem =
      this.normalizeIdempotencyKey(dto.idempotencyKey) ?? dto.ticketId;
    // Lock is per-ticket (global) so concurrent buyers of the same ticket serialize;
    // idempotency cache remains per user+key.
    const lockResource = IDEMPOTENCY_KEYS.ORDER_LOCK_IDEMPOTENCY_KEY(
      'ticket',
      dto.ticketId,
    );
    try {
      const existingId = await this.redis.get(lockResource);
      if (existingId) {
        const existing = await this.prismaService.order.findUnique({
          where: { id: existingId },
        });
        if (
          existing &&
          existing.userId === dto.userId &&
          (existing.status === OrderStatus.PENDING ||
            existing.status === OrderStatus.PAID)
        ) {
          return existing;
        }
      }
    } catch {
      // ignore cache errors
    }

    const order = await this.redisLockService.runExclusive<PaymentOrder>(
      lockResource,
      PAYMENT_LOCK_TTL_MS.CREATE,
      async () => {
        try {
          return await this.prismaService.$transaction(async (tx) => {
            // get ticket -> check time & status
            const ticket = await this.ticketService.getTicketById(
              dto.ticketId,
              tx,
            );
            if (!ticket) {
              throw new NotFoundException('Ticket not found');
            }
            if (ticket.ticketStatus === TicketStatus.BOOKED) {
              throw new ConflictException('Ticket already booked');
            }
            if (ticket.ticketStatus === TicketStatus.CANCELLED) {
              throw new ConflictException('Ticket is cancelled');
            }
            if (ticket.price !== dto.finalPrice) {
              throw new BadRequestException(
                `finalPrice ${dto.finalPrice} does not match ticket price ${ticket.price}`,
              );
            }

            const showTime = await tx.showTime.findUnique({
              where: { id: ticket.showTimeId },
            });
            if (!showTime) {
              throw new NotFoundException('Showtime not found');
            }
            if (showTime.endAt.getTime() <= Date.now()) {
              throw new BadRequestException('Showtime already ended');
            }
            const active = await tx.order.findFirst({
              where: {
                ticketId: dto.ticketId,
                status: { in: [OrderStatus.PENDING, OrderStatus.PAID] },
              },
              select: { id: true, status: true },
            });
            if (active) {
              throw new ConflictException(
                `Ticket already has active order ${active.status}`,
              );
            }
            if (ticket.ticketStatus === TicketStatus.AVAILABLE) {
              await this.ticketService.updateTicketStatus(
                ticket.id,
                TicketStatus.PROCESSING,
                tx,
              );
            }
            await tx.order.deleteMany({
              where: {
                ticketId: dto.ticketId,
                status: {
                  in: [
                    OrderStatus.EXPIRED,
                    OrderStatus.FAILED,
                    OrderStatus.CANCELLED,
                  ],
                },
              },
            });
            try {
              const replayId = await this.redis.get(lockResource);
              if (replayId) {
                const replay = await tx.order.findUnique({
                  where: { id: replayId },
                });
                if (
                  replay &&
                  replay.userId === dto.userId &&
                  (replay.status === OrderStatus.PENDING ||
                    replay.status === OrderStatus.PAID)
                ) {
                  return replay;
                }
              }
            } catch {
              // ignore cache errors
            }
            return await tx.order.create({
              data: {
                ticketId: dto.ticketId,
                userId: dto.userId,
                finalPrice: ticket.price,
                currency: dto.currency ?? 'VND',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
              },
            });
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new ConflictException(
              'Ticket already ordered or duplicate payment reference',
            );
          }
          throw error;
        }
      },
    );

    if (order === null) {
      throw new ConflictException(
        'Order creation is already in progress for this ticket',
      );
    }

    try {
      await this.redis.set(lockResource, order.id, 'EX', 5 * 60);
      await this.redis.set(`idemp:order:${order.id}`, idem, 'EX', 5 * 60);
    } catch {
      // ignore cache errors
    }

    return order;
  }

  async updateOrder(id: string, dto: UpdateOrderDto): Promise<PaymentOrder> {
    const result = await this.redisLockService.runExclusive<PaymentOrder>(
      IDEMPOTENCY_KEYS.ORDER_LOCK_IDEMPOTENCY_KEY(id, id),
      PAYMENT_LOCK_TTL_MS.UPDATE,
      async () => {
        return await this.prismaService.$transaction(async (tx) => {
          const current = await tx.order.findUnique({
            where: { id },
          });
          if (!current) {
            throw new NotFoundException('Order not found');
          }
          if (current.status === dto.status) {
            return current;
          }
          if (!ALLOWED_TRANSITIONS[current.status].includes(dto.status)) {
            throw new ConflictException(
              `Cannot transition order from ${current.status} to ${dto.status}`,
            );
          }
          try {
            return await tx.order.update({
              where: { id },
              data: { status: dto.status },
            });
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2025'
            ) {
              throw new NotFoundException('Order not found');
            }
            throw error;
          }
        });
      },
    );

    if (result === null) {
      throw new ConflictException(
        'Order update is already in progress for this order',
      );
    }

    return result;
  }

  async getOrder(id: string, userId: string): Promise<PaymentOrder | null> {
    return await this.prismaService.order.findFirst({
      where: { id, userId },
    });
  }

  async getOrderById(dto: GetOrderDto) {
    const order = await this.prismaService.order.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with id ${dto.orderId} not found`);
    }

    return order;
  }

  async getOwnerOrder(dto: GetOwnerOrderDto) {
    const order = await this.prismaService.order.findUnique({
      where: { id: dto.orderId, userId: dto.userId },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with id ${dto.orderId} and user id ${dto.userId} not found`,
      );
    }

    return order;
  }

  async saveStatus(
    orderId: string,
    data: Prisma.OrderUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PaymentOrder> {
    const client = tx ?? this.prismaService;
    try {
      return await client.order.update({
        where: { id: orderId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Duplicate Sepay reference');
      }
      throw error;
    }
  }

  async revokeIdempotencyKey(orderId: string, userId?: string): Promise<void> {
    try {
      const idem = await this.redis.get(`idemp:order:${orderId}`);
      if (!idem) return;
      const uid =
        userId ??
        (
          await this.prismaService.order.findUnique({
            where: { id: orderId },
            select: { userId: true },
          })
        )?.userId;
      if (uid) {
        await this.redis.del(
          `idemp:payment:create:${uid}:${idem}`,
          `idemp:order:${orderId}`,
        );
      } else {
        await this.redis.del(`idemp:order:${orderId}`);
      }
    } catch {
      // ignore cache errors
    }
  }

  async settlePaid(
    order: PaymentOrder,
    data: {
      sepayOrderId: string;
      sepayTransactionId: string;
      paymentMethod: string;
      paidAmount: number;
      callbackPayload: unknown;
    },
  ): Promise<PaymentOrder> {
    const updated = await this.prismaService.$transaction(async (tx) => {
      const paid = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          sepayOrderId: data.sepayOrderId,
          sepayTransactionId: data.sepayTransactionId,
          paymentMethod: data.paymentMethod,
          paidAmount: data.paidAmount,
          callbackPayload: data.callbackPayload as never,
        },
      });
      await this.ticketService.updateTicketStatus(
        order.ticketId,
        TicketStatus.BOOKED,
        tx,
      );
      return paid;
    });
    await this.revokeIdempotencyKey(updated.id, order.userId);
    return updated;
  }

  async settleFailed(
    order: PaymentOrder,
    data: {
      sepayOrderId: string;
      sepayTransactionId: string;
      paymentMethod: string;
      paidAmount: number;
      callbackPayload: unknown;
    },
    nextStatus: OrderStatus,
  ): Promise<PaymentOrder> {
    const updated = await this.prismaService.$transaction(async (tx) => {
      const u = await this.saveStatus(
        order.id,
        {
          status: nextStatus,
          sepayOrderId: data.sepayOrderId,
          sepayTransactionId: data.sepayTransactionId,
          paymentMethod: data.paymentMethod,
          paidAmount: data.paidAmount,
          callbackPayload: data.callbackPayload as never,
        },
        tx,
      );
      await this.ticketService.updateMany(
        { id: order.ticketId, ticketStatus: TicketStatus.PROCESSING },
        { ticketStatus: TicketStatus.AVAILABLE },
        tx,
      );
      return u;
    });
    await this.revokeIdempotencyKey(updated.id, order.userId);
    return updated;
  }

  async cancelOrder(order: PaymentOrder): Promise<PaymentOrder> {
    const updated = await this.prismaService.$transaction(async (tx) => {
      const u = await this.saveStatus(
        order.id,
        { status: OrderStatus.CANCELLED },
        tx,
      );
      await this.ticketService.updateMany(
        { id: order.ticketId, ticketStatus: TicketStatus.PROCESSING },
        { ticketStatus: TicketStatus.AVAILABLE },
        tx,
      );
      return u;
    });
    await this.revokeIdempotencyKey(updated.id, order.userId);
    return updated;
  }

  async expireOrder(order: PaymentOrder): Promise<PaymentOrder> {
    const updated = await this.prismaService.$transaction(async (tx) => {
      const u = await this.saveStatus(
        order.id,
        { status: OrderStatus.EXPIRED },
        tx,
      );
      await this.ticketService.updateMany(
        { id: order.ticketId, ticketStatus: TicketStatus.PROCESSING },
        { ticketStatus: TicketStatus.AVAILABLE },
        tx,
      );
      return u;
    });
    await this.revokeIdempotencyKey(updated.id, order.userId);
    return updated;
  }

  async expireDueOrders(): Promise<number> {
    const due = await this.prismaService.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      select: { id: true, ticketId: true },
    });
    if (due.length === 0) {
      return 0;
    }
    const result = await this.prismaService.$transaction(async (tx) => {
      const r = await tx.order.updateMany({
        where: {
          id: { in: due.map((o) => o.id) },
          status: OrderStatus.PENDING,
        },
        data: { status: OrderStatus.EXPIRED },
      });
      await tx.ticket.updateMany({
        where: {
          id: { in: due.map((o) => o.ticketId) },
          ticketStatus: TicketStatus.PROCESSING,
        },
        data: { ticketStatus: TicketStatus.AVAILABLE },
      });
      return r;
    });
    for (const o of due) {
      await this.revokeIdempotencyKey(o.id);
    }
    return result.count;
  }

  async syncOrder(
    orderId: string,
    userId: string,
  ): Promise<{ orderId: string; status: OrderStatus; idempotent: boolean }> {
    return this.redisLockService
      .runExclusive(
        IDEMPOTENCY_KEYS.ORDER_LOCK_IDEMPOTENCY_KEY(orderId, orderId),
        PAYMENT_LOCK_TTL_MS.UPDATE,
        async () => {
          const order = await this.getOwnerOrder({ orderId, userId });
          if (
            order.status === OrderStatus.PENDING &&
            order.expiresAt &&
            order.expiresAt.getTime() <= Date.now()
          ) {
            const updated = await this.expireOrder(order);
            return {
              orderId: updated.id,
              status: updated.status,
              idempotent: false,
            };
          }
          return { orderId: order.id, status: order.status, idempotent: true };
        },
      )
      .then((r) => {
        if (r === null) {
          throw new ConflictException(
            'Order update is already in progress for this order',
          );
        }
        return r;
      });
  }
}
