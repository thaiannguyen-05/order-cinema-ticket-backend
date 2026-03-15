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
      data: {
        row: dto.row,
        column: dto.column,
        filmId: dto.filmId,
        cinemaId: dto.cinemaId,
        ...(dto.status && { status: dto.status }),
      },
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
      data: {
        ...(dto.row !== undefined && { row: dto.row }),
        ...(dto.column !== undefined && { column: dto.column }),
        ...(dto.status && { status: dto.status }),
        ...(dto.filmId && { filmId: dto.filmId }),
        ...(dto.cinemaId !== undefined && { cinemaId: dto.cinemaId }),
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
    if (!dto.page) dto.page = 1;
    if (!dto.limit) dto.limit = 10;

    const where = {
      ...(dto.filmId && { filmId: dto.filmId }),
      ...(dto.cinemaId !== undefined && { cinemaId: dto.cinemaId }),
      ...(dto.status && { status: dto.status }),
    };

    if (dto.cursor) {
      const seats = await this.prismaService.seat.findMany({
        where,
        take: dto.limit + 1,
        cursor: { id: dto.cursor },
        skip: 1,
      });

      const hasNextPage = seats.length > dto.limit;
      const nextCursor = hasNextPage ? seats[seats.length - 1].id : null;

      return {
        seats: hasNextPage ? seats.slice(0, -1) : seats,
        nextCursor,
      };
    }

    const seats = await this.prismaService.seat.findMany({
      where,
      take: dto.limit + 1,
      skip: (dto.page - 1) * dto.limit,
    });

    const hasNextPage = seats.length > dto.limit;
    const nextCursor = hasNextPage ? seats[seats.length - 1].id : null;

    return {
      seats: hasNextPage ? seats.slice(0, -1) : seats,
      nextCursor,
    };
  }

  async getSeatsByShowtimeId(filmId: string, cinemaId: number) {
    return this.prismaService.seat.findMany({
      where: {
        cinemaId,
        filmId,
      },
    });
  }
}
