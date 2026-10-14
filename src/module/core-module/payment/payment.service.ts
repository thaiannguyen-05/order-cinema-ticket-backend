import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  async createOrder(dto: CreatePaymentDto): Promise<PaymentOrder> {
    const order = await this.redisLockService.runExclusive<PaymentOrder>(
      PAYMENT_LOCK_KEY.CREATE_BY_TICKET(dto.ticketId),
      PAYMENT_LOCK_TTL_MS.CREATE,
      async () => {
        try {
          return await this.prismaService.$transaction(async (tx) =>
            tx.order.create({
              data: {
                ...dto,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
              },
            }),
          );
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
