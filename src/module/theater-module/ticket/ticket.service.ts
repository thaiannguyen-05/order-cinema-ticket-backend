import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../background/prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketService {
  constructor(private readonly prismaService: PrismaService) {}

  async createTicket(dto: CreateTicketDto) {
    return await this.prismaService.ticket.create({
      data: {
        code: randomBytes(16).toString('hex'),
        price: dto.price,
        filmOfCinemaId: dto.filmOfCinemaId,
        seatId: dto.seatId,
      },
    });
  }

  async getTicketById(id: string) {
    return await this.prismaService.ticket.findUnique({
      where: {
        id,
      },
    });
  }

}
