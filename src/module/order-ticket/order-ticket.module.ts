import { Module } from '@nestjs/common';
import { OrderTicketService } from './order-ticket.service';
import { OrderTicketController } from './order-ticket.controller';

@Module({
  controllers: [OrderTicketController],
  providers: [OrderTicketService],
})
export class OrderTicketModule {}
