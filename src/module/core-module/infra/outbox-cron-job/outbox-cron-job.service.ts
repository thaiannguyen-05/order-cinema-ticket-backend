import { Injectable, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisLockService } from '../redis/redis.lock.service';
import { MyLogger } from '../logger/logger.service';
import { MetricsService } from '../metrics/metrics.service';
import { REDIS_LOCK_KEY, REDIS_TTL } from '../redis/redis.value';
import { OutboxService } from '../email/outbox.service';
import { EXP_TIME_OUTBOX } from '../email/constant/time';

@Injectable()
export class OutboxCronJobService {
  constructor(
    private readonly redisLockService: RedisLockService,
    private readonly logger: MyLogger,
    private readonly outBoxService: OutboxService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async removeOutboxExp() {
    const stopTimer = this.metrics?.cronStart('remove_outbox_exp');
    try {
      const lockResult = await this.redisLockService.runExclusive<void>(
        REDIS_LOCK_KEY.REMOVE_OUTBOX_EXP,
        REDIS_TTL.LOCK_SERVICE,
        async () => {
          const expirationTime = new Date(Date.now() - EXP_TIME_OUTBOX * 1000);
          const result =
            await this.outBoxService.deleteOutboxMessageExp(expirationTime);
          const deleted =
            typeof (result as { count?: number })?.count === 'number'
              ? (result as { count: number }).count
              : 0;
          this.metrics?.addOutboxDeleted(deleted);
          const pending = await this.outBoxService.countPending();
          if (pending >= 0) this.metrics?.setOutboxPending(pending);
        },
      );

      if (lockResult === null) {
        this.metrics?.cronSkipped('remove_outbox_exp');
        this.logger.debug('Skip request because lock is already held');
      } else {
        this.metrics?.cronSuccess('remove_outbox_exp');
      }
    } catch (error) {
      this.metrics?.cronFailed('remove_outbox_exp');
      throw error;
    } finally {
      stopTimer?.();
    }
  }
}
