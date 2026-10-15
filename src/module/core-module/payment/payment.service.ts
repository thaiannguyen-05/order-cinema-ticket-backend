import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../background/prisma/prisma.service';
import { RedisLockService } from '../../../background/redis/redis.lock.service';
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
  ) {}

  async createOrder(
    dto: CreatePaymentDto & { userId: string },
  ): Promise<PaymentOrder> {
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
            if (ticket.price !== dto.finalPrice) {
              throw new BadRequestException(
                `finalPrice ${dto.finalPrice} does not match ticket price ${ticket.price}`,
              );
            }
            // 1 ticket -> N orders (retry allowed after FAILED/CANCELLED/EXPIRED).
            // Only one active (PENDING/PAID) order per ticket.
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
            // Only IPN may decide PAID/FAILED. Force PENDING on create and
            // ignore gateway-controlled fields even if client sends them.
            return await tx.order.create({
              data: {
                finalPrice: ticket.price,
                currency: dto.currency,
                ticketId: dto.ticketId,
                userId: dto.userId,
                status: OrderStatus.PENDING,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
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
