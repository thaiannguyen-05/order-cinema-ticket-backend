import { Controller } from '@nestjs/common';
import { OrderTicketService } from './order-ticket.service';

@Controller('order-ticket')
export class OrderTicketController {
  constructor(private readonly orderTicketService: OrderTicketService) {}
}
