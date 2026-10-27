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
import { PAYMENT_LOCK_KEY, PAYMENT_LOCK_TTL_MS } from './constant';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { UpdatePaymentDto } from './dto/update-payment.dto';
import type { PaymentInterface } from './payment.interface';
import { ALLOWED_TRANSITIONS, type PaymentOrder } from './type';

@Injectable()
export class PaymentService implements PaymentInterface {
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
    dto: CreatePaymentDto & { userId: string; idempotencyKey?: string },
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
    dto: CreatePaymentDto & { userId: string; idempotencyKey?: string },
  ): Promise<PaymentOrder> {
    const idem = this.normalizeIdempotencyKey(dto.idempotencyKey);
    const idemRedisKey = idem
      ? `idemp:payment:create:${dto.userId}:${idem}`
      : null;

    // Fast path: replay of a previous request with the same key.
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
            // Lifecycle guard: ticket must exist, price is source of truth.
            // finalPrice client gửi lên chỉ để đối chiếu, không tin blind.
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
            // AVAILABLE -> PROCESSING: hold the ticket while Order is PENDING.
            // PAID path (Sepay IPN) flips it to BOOKED; FAILED/CANCELLED/EXPIRED
            // flips it back to AVAILABLE for retry.
            if (ticket.ticketStatus === TicketStatus.AVAILABLE) {
              await tx.ticket.update({
                where: { id: ticket.id },
                data: { ticketStatus: TicketStatus.PROCESSING },
              });
            }
            // Only IPN may decide PAID/FAILED. Force PENDING on create and
            // ignore gateway-controlled fields even if client sends them.
            // Explicit whitelist: never spread ...dto into order.create.
            // expiresAt is server-controlled (now + 15m).
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

  // Internal only: no longer exposed via PATCH /payment/:id.
  // PAID/FAILED must come from Sepay IPN (SepayService.applyIpn).
  async updateOrder(id: string, dto: UpdatePaymentDto): Promise<PaymentOrder> {
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
        // Idempotent: same status -> no-op.
        if (current.status === dto.status) {
          return current;
        }
        // Terminal states are immutable; only PENDING may transition.
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

  async getOrder(id: string): Promise<PaymentOrder | null> {
    return await this.prismaService.order.findUnique({ where: { id } });
  }
}
