import { Module } from '@nestjs/common';
import { OutboxCronJobService } from './outbox-cron-job.service';
import { RedisModule } from '../redis/redis.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [RedisModule, EmailModule],
  providers: [OutboxCronJobService],
})
export class OutboxCronJobModule {}
