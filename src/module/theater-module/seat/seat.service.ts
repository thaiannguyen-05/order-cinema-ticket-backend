import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../background/prisma/prisma.service';
import { CreateSeatDto } from './dto/create-seat.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { FindSeatDto } from './dto/find-seat.dto';

@Injectable()
export class SeatService {
  constructor(private readonly prismaService: PrismaService) {}

  async createSeat(dto: CreateSeatDto) {
    return this.prismaService.seat.create({
      data: dto,
    });
  }

  async getSeat(seatId: string) {
    return this.prismaService.seat.findUnique({
      where: {
        id: seatId,
      },
    });
  }

  async updateSeat(seatId: string, dto: UpdateSeatDto) {
    return this.prismaService.seat.update({
      where: {
        id: seatId,
      },
      data: dto,
    });
  }

  async deleteSeat(seatId: string) {
    return this.prismaService.seat.delete({
      where: {
        id: seatId,
      },
    });
  }

  async findSeats(dto: FindSeatDto) {
    const { limit, page, roomId, seatType, seatStatus } = dto;

    const where = {
      ...(roomId && { roomId }),
      ...(seatType && { seatType }),
      ...(seatStatus && { seatStatus }),
    };

    const [total, seats] = await Promise.all([
      this.prismaService.seat.count({ where }),
      this.prismaService.seat.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { id: 'asc' },
      }),
    ]);

    return {
      seats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSeatsByRoomId(roomId: string) {
    return this.prismaService.seat.findMany({
      where: {
        roomId,
      },
      orderBy: { id: 'asc' },
    });
  }
}
