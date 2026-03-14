import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TicketService } from './ticket.service';
import type { CreateTicketDto } from './dto/create-ticket.dto';
import { User } from '../../core/decorator/user.decorator';

@Controller('ticket')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post('order')
  orderTicket(
    @Body() createTicketDto: CreateTicketDto,
    @User('id') userId: string,
  ) {
    return this.ticketService.orderTicket(createTicketDto, userId);
  }

  @Get('seat/:seatId')
  findBySeat(@Param('seatId') seatId: string, @User('id') userId: string) {
    return this.ticketService.getTicketsByUserId(userId, seatId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketService.getTicketById(id);
  }
}
