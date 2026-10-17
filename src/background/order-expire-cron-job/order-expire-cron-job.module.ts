import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { OrderExpireCronJobService } from './order-expire-cron-job.service';

@Module({
  imports: [RedisModule],
  providers: [OrderExpireCronJobService],
})
export class OrderExpireCronJobModule {}
