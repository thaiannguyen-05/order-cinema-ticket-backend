import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { SepayService } from './sepay.service';
import { PaymentController } from './payment.controller';
import { TicketModule } from '../../theater-module/ticket/ticket.module';

@Module({
  imports: [TicketModule],
  controllers: [PaymentController],
  providers: [PaymentService, SepayService],
  exports: [SepayService],
})
export class PaymentModule {}
