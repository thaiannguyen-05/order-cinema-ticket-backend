import { Injectable } from '@nestjs/common';
import { OUTBOX_STATUS, type Outbox } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailPayload } from './type';

@Injectable()
export class OutboxService {
  constructor(private readonly prismaService: PrismaService) {}

  async getOutBox(id: string) {
    return await this.prismaService.outbox.findUnique({ where: { id } });
  }

  async createOutboxMessage(
    eventType: string,
    payload: EmailPayload,
  ): Promise<Outbox> {
    return this.prismaService.outbox.create({
      data: {
        eventType,
        payload,
        status: OUTBOX_STATUS.PENDING,
      },
    });
  }

  async updateOutboxMessage(id: string, status: OUTBOX_STATUS) {
    return this.prismaService.outbox.update({
      where: { id: id },
      data: {
        status: status,
      },
    });
  }

  async deleteOutboxMessageExp(expirationTime: Date) {
    return this.prismaService.outbox.deleteMany({
      where: { updatedAt: { lt: expirationTime } },
    });
  }
}
