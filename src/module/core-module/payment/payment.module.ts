import { Module } from '@nestjs/common';
import { RedisModule } from '../infra/redis/redis.module';
import { SepayService } from './sepay.service';
import { PaymentController } from './payment.controller';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [RedisModule, OrderModule],
  controllers: [PaymentController],
  providers: [SepayService],
})
export class PaymentModule {}
