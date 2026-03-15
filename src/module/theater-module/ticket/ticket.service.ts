import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../background/prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { RedisLockService } from '../../../background/redis/redis.lock.service';
import { MyLogger } from '../../../core/logger/logger.service';
import {
  REDIS_LOCK_KEY,
  REDIS_TTL,
} from '../../../background/redis/redis.value';

@Injectable()
export class TicketService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisLockService: RedisLockService,
    private readonly logger: MyLogger,
  ) {}

  async createTicket(dto: CreateTicketDto, userId: string) {
    return await this.prismaService.ticket.create({
      data: {
        code:
          Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15),
        price: dto.price,
        userId: userId,
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

  async getTicketsByUserId(userId: string, seatId: string) {
    return await this.prismaService.ticket.findUnique({
      where: {
        userId,
        seatId,
      },
    });
  }

  async orderTicket(dto: CreateTicketDto, userId: string) {
    const lockResult = await this.redisLockService.runExclusive<void>(
      REDIS_LOCK_KEY.ORDER_TICKET(userId, dto.seatId),
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        const isOrderSuccess = await this.createTicket(dto, userId);

        if (!isOrderSuccess) {
          throw new Error('Order ticket failed');
        }
      },
    );

    if (lockResult === null) {
      this.logger.debug(`User ${userId} is ordering seat ${dto.seatId}`);
    }
  }
}
