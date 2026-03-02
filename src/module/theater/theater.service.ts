import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../background/prisma/prisma.service';
import { SaveCinemasDto } from './dto/save-cinemas.dto';
import { Cinema } from '@andev2005/movie-glu-sdk';
import { UpdateCinema } from './dto/update-cinema.dto';
import { GetDetailCinemaDto } from './dto/getDetailCinema.dto';

@Injectable()
export class TheaterService {
  constructor(private readonly prismaService: PrismaService) {}

  async savingCinemas(dto: SaveCinemasDto) {
    return await this.prismaService.theater.createMany({
      data: dto.cinemas,
      skipDuplicates: false,
    });
  }

  async savingCinema(cinema: Cinema) {
    return await this.prismaService.theater.create({
      data: cinema,
    });
  }

  async getAvailableCinemas() {
    return await this.prismaService.theater.findMany();
  }

  async updateCinema(cinemaId: number, dto: UpdateCinema) {
    return await this.prismaService.theater.update({
      where: { cinema_id: cinemaId },
      data: {
        ...dto,
      },
    });
  }

  async upsertCinema(cinemaId: number, dto: Cinema) {
    return await this.prismaService.theater.upsert({
      where: { cinema_id: cinemaId },
      update: {
        ...dto,
      },
      create: {
        ...dto,
        cinema_id: cinemaId,
      },
    });
  }

  async getCinemas() {
    return await this.prismaService.theater.findMany();
  }

  async getDetailCinema(dto: GetDetailCinemaDto) {
    return await this.prismaService.theater.findUnique({
      where: { cinema_id: dto.cinemaId },
      include: {
        filmOfTheaters: {
          select: {
            name: true,
            performers: true,
            type: true,
            length: true,
            rated: true,
            times: true,
            
          }
        },
      },
    });
  }
}
