import { Module } from '@nestjs/common';
import { OutboxCronJobService } from './outbox-cron-job.service';

@Module({
  controllers: [],
  providers: [OutboxCronJobService],
})
export class OutboxCronJobModule {}
