import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MyLogger } from '../../core/logger/logger.service';
import { RedisLockService } from '../redis/redis.lock.service';
import { REDIS_LOCK_KEY, REDIS_TTL } from '../redis/redis.value';

@Injectable()
export class OrderExpireCronJobService {
  constructor(
    private readonly redisLockService: RedisLockService,
    private readonly logger: MyLogger,
    private readonly prismaService: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expirePendingOrders() {
    const lockResult = await this.redisLockService.runExclusive<void>(
      REDIS_LOCK_KEY.EXPIRE_PENDING_ORDERS,
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        const result = await this.prismaService.order.updateMany({
          where: {
            status: OrderStatus.PENDING,
            expiresAt: { lte: new Date() },
          },
          data: { status: OrderStatus.EXPIRED },
        });
        if (result.count > 0) {
          this.logger.log(
            `Expired ${result.count} pending orders`,
            'OrderExpireCronJob',
          );
        }
      },
    );

    if (lockResult === null) {
      this.logger.debug(
        'Skip expire pending orders because lock is already held',
        'OrderExpireCronJob',
      );
    }
  }
}
