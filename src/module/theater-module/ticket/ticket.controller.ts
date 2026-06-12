import { Controller, Get, Param } from '@nestjs/common';
import { TicketService } from './ticket.service';

@Controller('ticket')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketService.getTicketById(id);
  }
}
