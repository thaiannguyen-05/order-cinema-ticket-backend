import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../background/prisma/prisma.service';
import { RedisLockService } from '../../../background/redis/redis.lock.service';
import { PAYMENT_LOCK_KEY, PAYMENT_LOCK_TTL_MS } from './constant';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { UpdatePaymentDto } from './dto/update-payment.dto';
import type { PaymentInterface } from './payment.interface';
import type { PaymentOrder } from './type';

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
    return await this.prismaService.order.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async getOrder(id: string): Promise<PaymentOrder | null> {
    return await this.prismaService.order.findUnique({ where: { id } });
  }
}
