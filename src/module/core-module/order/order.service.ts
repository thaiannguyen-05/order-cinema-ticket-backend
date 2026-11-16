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
import { PAYMENT_LOCK_KEY, PAYMENT_LOCK_TTL_MS } from '../payment/constant';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { GetOrderDto } from './dto/get-order.dto';
import { GetOwnerOrderDto } from './dto/get-owner-order.dto';
import { ALLOWED_TRANSITIONS, PaymentOrder } from './type';

@Injectable()
export class OrderService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisLockService: RedisLockService,
    @Inject(REDIS_LOCK_CLIENT) private readonly redis: Redis,
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
    const idem = this.normalizeIdempotencyKey(dto.idempotencyKey);
    const idemRedisKey = idem
      ? `idemp:payment:create:${dto.userId}:${idem}`
      : null;

    if (idemRedisKey) {
      try {
        const existingId = await this.redis.get(idemRedisKey);
        if (existingId) {
          const existing = await this.prismaService.order.findUnique({
            where: { id: existingId },
          });
          if (existing && existing.userId === dto.userId) return existing;
        }
      } catch {
        // ignore cache errors
      }
    }

    const order = await this.redisLockService.runExclusive<PaymentOrder>(
      PAYMENT_LOCK_KEY.CREATE_BY_TICKET(dto.ticketId),
      PAYMENT_LOCK_TTL_MS.CREATE,
      async () => {
        try {
          return await this.prismaService.$transaction(async (tx) => {
            const ticket = await tx.ticket.findUnique({
              where: { id: dto.ticketId },
            });
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
              await tx.ticket.update({
                where: { id: ticket.id },
                data: { ticketStatus: TicketStatus.PROCESSING },
              });
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
            if (idemRedisKey) {
              try {
                const replayId = await this.redis.get(idemRedisKey);
                if (replayId) {
                  const replay = await tx.order.findUnique({
                    where: { id: replayId },
                  });
                  if (replay && replay.userId === dto.userId) return replay;
                }
              } catch {
                // ignore cache errors
              }
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

    if (idemRedisKey) {
      try {
        await this.redis.set(idemRedisKey, order.id, 'EX', 24 * 60 * 60);
      } catch {
        // ignore cache errors
      }
    }

    return order;
  }

  async updateOrder(id: string, dto: UpdateOrderDto): Promise<PaymentOrder> {
    const result = await this.redisLockService.runExclusive<PaymentOrder>(
      PAYMENT_LOCK_KEY.UPDATE_BY_ORDER(id),
      PAYMENT_LOCK_TTL_MS.UPDATE,
      async () => {
        const current = await this.prismaService.order.findUnique({
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
          return await this.prismaService.order.update({
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
  ): Promise<PaymentOrder> {
    try {
      return await this.prismaService.order.update({
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
}
