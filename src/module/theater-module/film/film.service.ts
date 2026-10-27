import { Injectable, Optional } from '@nestjs/common';
import { CreateFilmDto } from './dto/create-film.dto';
import { FindFilmsDto } from './dto/find-films.dto';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { PrismaReplicaService } from '../../core-module/infra/prisma/prisma-replica.service';
import { MetricsService } from '../../core-module/infra/metrics/metrics.service';

@Injectable()
export class FilmService {
  constructor(
    private readonly prismaService: PrismaService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly replica?: PrismaReplicaService,
  ) {}

  private get read() {
    return this.replica ?? this.prismaService;
  }

  private get readSource(): 'replica' | 'leader' {
    return this.replica ? 'replica' : 'leader';
  }

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
    try {
      const films = await this.read.film.findMany({
        orderBy: { id: 'asc' },
      });
      this.metrics?.incReplicaRead(this.readSource, 'film', 'success');
      return films;
    } catch (error) {
      this.metrics?.incReplicaRead(this.readSource, 'film', 'error');
      throw error;
    }
  }

  async deleteFilm(id: string) {
    return await this.prismaService.film.delete({
      where: { id },
    });
  }

  async getFilm(id: string) {
    try {
      const film = await this.read.film.findUnique({
        where: { id },
      });
      this.metrics?.incReplicaRead(this.readSource, 'film', 'success');
      return film;
    } catch (error) {
      this.metrics?.incReplicaRead(this.readSource, 'film', 'error');
      throw error;
    }
  }

  async findFilms(dto: FindFilmsDto) {
    const start = process.hrtime.bigint();
    const { limit, page, search } = dto;

    const where = {
      film_name: {
        contains: search,
        mode: 'insensitive' as const,
      },
    };

    try {
      const [total, films] = await Promise.all([
        this.read.film.count({ where }),
        this.read.film.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: { id: 'asc' },
        }),
      ]);

      this.metrics?.observeSearch(
        'film',
        'success',
        Number(process.hrtime.bigint() - start) / 1e9,
      );
      this.metrics?.incReplicaRead(this.readSource, 'film', 'success');

      return {
        films,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.metrics?.observeSearch(
        'film',
        'error',
        Number(process.hrtime.bigint() - start) / 1e9,
      );
      this.metrics?.incReplicaRead(this.readSource, 'film', 'error');
      throw error;
    }
  }
}
