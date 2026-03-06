import { Injectable } from '@nestjs/common';
import { CreateCinemaDto } from './dto/create-cinema.dto';
import { UpdateCinemaDto } from './dto/update-cinema.dto';
import { FindCinemaDto } from './dto/find-cinema.dto';
import { PrismaService } from '../../../background/prisma/prisma.service';

@Injectable()
export class CinemaService {
  constructor(private readonly prismaService: PrismaService) {}

  async createCinema(createCinemaDto: CreateCinemaDto) {
    const cinema = await this.prismaService.cinema.create({
      data: {
        cinema_id: createCinemaDto.cinema_id,
        cinema_name: createCinemaDto.cinema_name,
        address: createCinemaDto.address,
        city: createCinemaDto.city,
        postcode: createCinemaDto.postcode,
        logo_url: createCinemaDto.logo_url,
        ...(createCinemaDto.address2 && {
          address2: createCinemaDto.address2,
        }),
        ...(createCinemaDto.country && { country: createCinemaDto.country }),
        ...(createCinemaDto.phone && { phone: createCinemaDto.phone }),
      },
    });

    return cinema;
  }

  async updateCinema(dto: UpdateCinemaDto, cinema_id: number) {
    const updatedCinema = await this.prismaService.cinema.update({
      where: { cinema_id },
      data: {
        ...(dto.cinema_name && { cinema_name: dto.cinema_name }),
        ...(dto.city && { city: dto.city }),
        ...(dto.postcode && { postcode: dto.postcode }),
        ...(dto.logo_url && { logo_url: dto.logo_url }),
        ...(dto.address && { address: dto.address }),
        ...(dto.address2 && { address2: dto.address2 }),
        ...(dto.country && { country: dto.country }),
        ...(dto.phone && { phone: dto.phone }),
      },
    });
    return updatedCinema;
  }

  async deleteCinema(cinema_id: number) {
    await this.prismaService.cinema.delete({
      where: { cinema_id },
    });
  }

  async getCinema(cinema_id: number) {
    const cinema = await this.prismaService.cinema.findUnique({
      where: { cinema_id },
    });
    return cinema;
  }

  async findCinemas(dto: FindCinemaDto) {
    if (!dto.page) dto.page = 1;
    if (!dto.limit) dto.limit = 10;

    if (dto.cursor) {
      const cinemas = await this.prismaService.cinema.findMany({
        where: {
          cinema_name: {
            contains: dto.search,
            mode: 'insensitive',
          },
        },
        take: dto.limit + 1,
        cursor: { cinema_id: dto.cursor },
        skip: 1,
        select: {
          cinema_id: true,
          cinema_name: true,
          address: true,
          city: true,
          postcode: true,
          logo_url: true,
        },
      });

      const hashNextPage = cinemas.length > dto.limit;
      const nextCursor = hashNextPage
        ? cinemas[cinemas.length - 1].cinema_id
        : null;
      return {
        cinemas: hashNextPage ? cinemas.slice(0, -1) : cinemas,
        nextCursor,
      };
    }

    const cinemas = await this.prismaService.cinema.findMany({
      where: {
        cinema_name: {
          contains: dto.search,
          mode: 'insensitive',
        },
      },
      skip: dto.limit + 1,
      take: dto.limit,
    });

    const hashNextPage = cinemas.length > dto.limit;
    const nextCursor = hashNextPage
      ? cinemas[cinemas.length - 1].cinema_id
      : null;
    return {
      cinemas: hashNextPage ? cinemas.slice(0, -1) : cinemas,
      nextCursor,
    };
  }

  async upsertCinema(dto: CreateCinemaDto) {
    return await this.prismaService.cinema.upsert({
      where: { cinema_id: dto.cinema_id },
      update: {
        ...(dto.address && { address: dto.address }),
        ...(dto.address2 && { address2: dto.address2 }),
        ...(dto.city && { city: dto.city }),
        ...(dto.country && { country: dto.country }),
        ...(dto.logo_url && { logo_url: dto.logo_url }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.postcode && { postcode: dto.postcode }),
        ...(dto.cinema_name && { cinema_name: dto.cinema_name }),
      },
      create: {
        cinema_id: dto.cinema_id,
        cinema_name: dto.cinema_name,
        address: dto.address,
        city: dto.city,
        postcode: dto.postcode,
        logo_url: dto.logo_url,
        ...(dto.address2 && {
          address2: dto.address2,
        }),
        ...(dto.country && { country: dto.country }),
        ...(dto.phone && { phone: dto.phone }),
      },
    });
  }

  async getFilmsOfCinema(cinema_id: number) {
    return await this.prismaService.cinema.findMany({
      where: {
        cinema_id,
      },
      select: {
        filmOfCinema: {
          include: {
            film: true,
          },
        },
      },
    });
  }
}
