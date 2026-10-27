import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { PrismaReplicaService } from '../../core-module/infra/prisma/prisma-replica.service';
import { MetricsService } from '../../core-module/infra/metrics/metrics.service';
import { CreateSeatDto } from './dto/create-seat.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { FindSeatDto } from './dto/find-seat.dto';

@Injectable()
export class SeatService {
  constructor(
    private readonly prismaService: PrismaService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly replica?: PrismaReplicaService,
  ) {}

  private get read() {
    return this.replica ?? this.prismaService;
  }

  async createSeat(dto: CreateSeatDto) {
    const { roomId, ...rest } = dto;
    return this.prismaService.seat.create({
      data: {
        ...rest,
        ...(roomId && { room: { connect: { id: roomId } } }),
      },
    });
  }

  async getSeat(seatId: string) {
    return this.read.seat.findUnique({
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
      data: {
        ...dto,
      },
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
    const start = process.hrtime.bigint();
    const { limit, page, roomId, seatType, seatStatus } = dto;

    const where = {
      ...(roomId && { roomId }),
      ...(seatType && { seatType }),
      ...(seatStatus && { seatStatus }),
    };

    try {
      const [total, seats] = await Promise.all([
        this.read.seat.count({ where }),
        this.read.seat.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: { id: 'asc' },
        }),
      ]);

      this.metrics?.observeSearch(
        'seat',
        'success',
        Number(process.hrtime.bigint() - start) / 1e9,
      );

      return {
        seats,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.metrics?.observeSearch(
        'seat',
        'error',
        Number(process.hrtime.bigint() - start) / 1e9,
      );
      throw error;
    }
  }

  async getSeatsByRoomId(roomId: string) {
    return this.read.seat.findMany({
      where: {
        roomId,
      },
      orderBy: { id: 'asc' },
    });
  }
}
