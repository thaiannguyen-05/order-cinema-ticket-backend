import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisLockService } from '../redis/redis.lock.service';
import { MyLogger } from '../../core/logger/logger.service';
import { REDIS_LOCK_KEY, REDIS_TTL } from '../redis/redis.value';
import { OutboxService } from '../email/outbox.service';
import { EXP_TIME_OUTBOX } from '../email/constant/time';

@Injectable()
export class OutboxCronJobService {
  constructor(
    private readonly redisLockService: RedisLockService,
    private readonly logger: MyLogger,
    private readonly outBoxService: OutboxService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async removeOutboxExp() {
    const lockResult = await this.redisLockService.runExclusive<void>(
      REDIS_LOCK_KEY.REMOVE_OUTBOX_EXP,
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        const expirationTime = new Date(Date.now() - EXP_TIME_OUTBOX * 1000);
        await this.outBoxService.deleteOutboxMessageExp(expirationTime);
      },
    );

    if (lockResult === null) {
      this.logger.debug('Skip request because lock is already held');
    }
  }
}
