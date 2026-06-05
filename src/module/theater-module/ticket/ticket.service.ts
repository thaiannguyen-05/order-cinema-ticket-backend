import { ConflictException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
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
        code: randomBytes(16).toString('hex'),
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
    const lockResult = await this.redisLockService.runExclusive(
      REDIS_LOCK_KEY.ORDER_TICKET(dto.seatId),
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        // Kiểm tra seat đã được đặt chưa
        const existingTicket = await this.prismaService.ticket.findUnique({
          where: { seatId: dto.seatId },
        });
        if (existingTicket) {
          throw new ConflictException('This seat has already been booked');
        }

        return await this.createTicket(dto, userId);
      },
    );

    if (lockResult === null) {
      throw new ConflictException(
        'This seat is being booked by another user, please try again',
      );
    }

    return lockResult;
  }
}
