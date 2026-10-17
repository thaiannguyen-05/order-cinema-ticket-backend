import { Injectable } from '@nestjs/common';
import { CreateFilmDto } from './dto/create-film.dto';
import { FindFilmsDto } from './dto/find-films.dto';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';

@Injectable()
export class FilmService {
  constructor(private readonly prismaService: PrismaService) {}

  async createFilm(dto: CreateFilmDto) {
    return await this.prismaService.film.create({
      data: dto,
    });
  }

  async updateFilm(id: string, data: Partial<CreateFilmDto>) {
    return await this.prismaService.film.update({
      where: { id },
      data,
    });
  }

  async getAllFilms() {
    return await this.prismaService.film.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async deleteFilm(id: string) {
    return await this.prismaService.film.delete({
      where: { id },
    });
  }

  async getFilm(id: string) {
    return await this.prismaService.film.findUnique({
      where: { id },
    });
  }

  async findFilms(dto: FindFilmsDto) {
    const { limit, page, search } = dto;

    const where = {
      film_name: {
        contains: search,
        mode: 'insensitive' as const,
      },
    };

    const [total, films] = await Promise.all([
      this.prismaService.film.count({ where }),
      this.prismaService.film.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { id: 'asc' },
      }),
    ]);

    return {
      films,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
