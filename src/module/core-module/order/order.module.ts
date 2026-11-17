import { Module } from '@nestjs/common';
import { RedisModule } from '../infra/redis/redis.module';
import { TicketModule } from '../../theater-module/ticket/ticket.module';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';

@Module({
  imports: [RedisModule, TicketModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
