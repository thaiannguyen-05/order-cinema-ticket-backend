import { Injectable, Optional } from '@nestjs/common';
import { CreateFilmDto } from './dto/create-film.dto';
import { FindFilmsDto } from './dto/find-films.dto';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { PrismaReplicaService } from '../../core-module/infra/prisma/prisma-replica.service';
import { ReplicaFailoverService } from '../../core-module/infra/prisma/replica-failover.service';
import { MetricsService } from '../../core-module/infra/metrics/metrics.service';

@Injectable()
export class FilmService {
  constructor(
    private readonly prismaService: PrismaService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly replica?: PrismaReplicaService,
    @Optional() private readonly failover?: ReplicaFailoverService,
  ) {}

  /**
   * Leader-first with follower fallback: try leader, on error retry once on
   * follower. When the circuit is open, skip the follower fallback entirely.
   */
  private async runRead<T>(
    target: 'film',
    op: (db: PrismaService | PrismaReplicaService) => Promise<T>,
  ): Promise<T> {
    try {
      const result = await op(this.prismaService);
      this.metrics?.incReplicaRead('leader', target, 'success');
      return result;
    } catch (leaderError) {
      this.metrics?.incReplicaRead('leader', target, 'error');
      if (this.replica && (!this.failover || this.failover.useReplica())) {
        try {
          const result = await op(this.replica);
          this.failover?.onSuccess();
          this.metrics?.incReplicaRead('replica', target, 'success');
          return result;
        } catch (replicaError) {
          this.failover?.onFailure();
          this.metrics?.incReplicaRead('replica', target, 'error');
          throw replicaError;
        }
      }
      throw leaderError;
    }
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
    return this.runRead('film', (db) =>
      db.film.findMany({
        orderBy: { id: 'asc' },
      }),
    );
  }

  async deleteFilm(id: string) {
    return await this.prismaService.film.delete({
      where: { id },
    });
  }

  async getFilm(id: string) {
    return this.runRead('film', (db) =>
      db.film.findUnique({
        where: { id },
      }),
    );
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
      const [total, films] = await this.runRead('film', (db) =>
        Promise.all([
          db.film.count({ where }),
          db.film.findMany({
            where,
            take: limit,
            skip: (page - 1) * limit,
            orderBy: { id: 'asc' },
          }),
        ]),
      );

      this.metrics?.observeSearch(
        'film',
        'success',
        Number(process.hrtime.bigint() - start) / 1e9,
      );

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
      throw error;
    }
  }
}
