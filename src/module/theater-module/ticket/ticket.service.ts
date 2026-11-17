import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class TicketService {
  constructor(private readonly prismaService: PrismaService) {}

  private client(tx?: Tx): PrismaService | Tx {
    return tx ?? this.prismaService;
  }

  async createTicket(dto: CreateTicketDto, tx?: Tx) {
    return await this.client(tx).ticket.create({
      data: {
        ...dto,
      },
    });
  }

  async getTicketById(id: string, tx?: Tx) {
    return await this.client(tx).ticket.findUnique({
      where: {
        id,
      },
    });
  }

  async updateTicketStatus(
    id: string,
    ticketStatus: import('@prisma/client').TicketStatus,
    tx?: Tx,
  ) {
    return await this.client(tx).ticket.updateMany({
      where: { id },
      data: { ticketStatus },
    });
  }

  async updateMany(
    where: Prisma.TicketWhereInput,
    data: Prisma.TicketUpdateManyMutationInput,
    tx?: Tx,
  ) {
    return await this.client(tx).ticket.updateMany({ where, data });
  }
}
