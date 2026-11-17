import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { OrderModule } from '../../order/order.module';
import { OrderExpireCronJobService } from './order-expire-cron-job.service';

@Module({
  imports: [RedisModule, OrderModule],
  providers: [OrderExpireCronJobService],
})
export class OrderExpireCronJobModule {}
