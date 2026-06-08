import { Controller, Get, Param } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { User } from '../../../core/decorator/user.decorator';

@Controller('ticket')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get('seat/:seatId')
  findBySeat(@Param('seatId') seatId: string, @User('id') userId: string) {
    return this.ticketService.getTicketsByUserId(userId, seatId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketService.getTicketById(id);
  }
}
