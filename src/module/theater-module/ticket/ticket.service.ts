import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketService {
  constructor(private readonly prismaService: PrismaService) {}

  async createTicket(dto: CreateTicketDto) {
    return await this.prismaService.ticket.create({
      data: {
        ...dto,
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
