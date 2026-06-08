import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentService } from './payment.service';
import { SepayService } from './sepay.service';
import { PaymentController } from './payment.controller';
import { TicketModule } from '../../theater-module/ticket/ticket.module';
import { RedisModule } from '../../../background/redis/redis.module';

@Module({
  imports: [TicketModule, HttpModule, RedisModule],
  controllers: [PaymentController],
  providers: [PaymentService, SepayService],
  exports: [SepayService],
})
export class PaymentModule {}
