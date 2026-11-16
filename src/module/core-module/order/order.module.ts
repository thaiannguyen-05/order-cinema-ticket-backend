import { Module } from '@nestjs/common';
import { RedisModule } from '../infra/redis/redis.module';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';

@Module({
  imports: [RedisModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
