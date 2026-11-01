import { Injectable, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MyLogger } from '../logger/logger.service';
import { RedisLockService } from '../redis/redis.lock.service';
import { MetricsService } from '../metrics/metrics.service';
import { REDIS_LOCK_KEY, REDIS_TTL } from '../redis/redis.value';

@Injectable()
export class OrderExpireCronJobService {
  constructor(
    private readonly redisLockService: RedisLockService,
    private readonly logger: MyLogger,
    private readonly prismaService: PrismaService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expirePendingOrders() {
    const stopTimer = this.metrics?.cronStart('expire_pending_orders');
    try {
      const lockResult = await this.redisLockService.runExclusive<void>(
        REDIS_LOCK_KEY.EXPIRE_PENDING_ORDERS,
        REDIS_TTL.LOCK_SERVICE,
        async () => {
          // Collect due orders first so the coupled Ticket hold can be released
          // atomically in the same lock scope (PENDING->EXPIRED must free
          // PROCESSING->AVAILABLE like sync/webhook/cancel paths do).
          const due = await this.prismaService.order.findMany({
            where: {
              status: OrderStatus.PENDING,
              expiresAt: { lte: new Date() },
            },
            select: { id: true, ticketId: true },
          });
          if (due.length === 0) {
            return;
          }
          const result = await this.prismaService.order.updateMany({
            where: {
              id: { in: due.map((o) => o.id) },
              status: OrderStatus.PENDING,
            },
            data: { status: OrderStatus.EXPIRED },
          });
          await this.prismaService.ticket.updateMany({
            where: {
              id: { in: due.map((o) => o.ticketId) },
              ticketStatus: TicketStatus.PROCESSING,
            },
            data: { ticketStatus: TicketStatus.AVAILABLE },
          });
          this.metrics?.addExpiredOrders(result.count);
          if (result.count > 0) {
            this.logger.log(
              `Expired ${result.count} pending orders`,
              'OrderExpireCronJob',
            );
          }
        },
      );

      if (lockResult === null) {
        this.metrics?.cronSkipped('expire_pending_orders');
        this.logger.debug(
          'Skip expire pending orders because lock is already held',
          'OrderExpireCronJob',
        );
      } else {
        this.metrics?.cronSuccess('expire_pending_orders');
      }
    } catch (error) {
      this.metrics?.cronFailed('expire_pending_orders');
      throw error;
    } finally {
      stopTimer?.();
    }
  }
}
