import { Module } from '@nestjs/common';
import { RedisModule } from '../../../background/redis/redis.module';
import { PaymentService } from './payment.service';
import { SepayService } from './sepay.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [RedisModule],
  controllers: [PaymentController],
  providers: [PaymentService, SepayService],
})
export class PaymentModule {}
