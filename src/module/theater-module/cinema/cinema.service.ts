import { Injectable, Optional } from '@nestjs/common';
import { CreateCinemaDto } from './dto/create-cinema.dto';
import { UpdateCinemaDto } from './dto/update-cinema.dto';
import { FindCinemaDto } from './dto/find-cinema.dto';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { PrismaReplicaService } from '../../core-module/infra/prisma/prisma-replica.service';
import { ReplicaFailoverService } from '../../core-module/infra/prisma/replica-failover.service';
import { MetricsService } from '../../core-module/infra/metrics/metrics.service';

@Injectable()
export class CinemaService {
  constructor(
    private readonly prismaService: PrismaService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly replica?: PrismaReplicaService,
    @Optional() private readonly failover?: ReplicaFailoverService,
  ) {}

  /**
   * Leader-first with follower fallback: try leader, on error retry once on
   * follower. When the circuit is open (follower repeatedly failing),
   * skip the follower and rethrow the leader error.
   */
  private async runRead<T>(
    target: 'cinema',
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

  async createCinema(createCinemaDto: CreateCinemaDto) {
    const cinema = await this.prismaService.cinema.create({
      data: createCinemaDto,
    });

    return cinema;
  }

  async updateCinema(dto: UpdateCinemaDto, cinema_id: number) {
    const updatedCinema = await this.prismaService.cinema.update({
      where: { cinema_id },
      data: dto,
    });
    return updatedCinema;
  }

  async deleteCinema(cinema_id: number) {
    await this.prismaService.cinema.delete({
      where: { cinema_id },
    });
  }

  async getCinema(cinema_id: number) {
    return this.runRead('cinema', (db) =>
      db.cinema.findUnique({
        where: { cinema_id },
      }),
    );
  }

  async findCinemas(dto: FindCinemaDto) {
    const start = process.hrtime.bigint();
    try {
      const result = await this.runRead('cinema', (db) =>
        this.doFindCinemas(db, dto),
      );
      this.metrics?.observeSearch(
        'cinema',
        'success',
        Number(process.hrtime.bigint() - start) / 1e9,
      );
      return result;
    } catch (error) {
      this.metrics?.observeSearch(
        'cinema',
        'error',
        Number(process.hrtime.bigint() - start) / 1e9,
      );
      throw error;
    }
  }

  private async doFindCinemas(
    db: PrismaService | PrismaReplicaService,
    dto: FindCinemaDto,
  ) {
    if (!dto.page) dto.page = 1;
    if (!dto.limit) dto.limit = 10;

    if (dto.cursor) {
      const cinemas = await db.cinema.findMany({
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

    const cinemas = await db.cinema.findMany({
      where: {
        cinema_name: {
          contains: dto.search,
          mode: 'insensitive',
        },
      },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit + 1,
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
      update: dto,
      create: dto,
    });
  }

  async getFilmsOfCinema(cinema_id: number) {
    return await this.getFilmsOfCinemas([cinema_id]);
  }

  async getFilmsOfCinemas(cinemaIds: number[]) {
    if (!cinemaIds.length) {
      return [];
    }

    return this.runRead('cinema', (db) =>
      db.cinema.findMany({
        where: {
          cinema_id: {
            in: cinemaIds,
          },
        },
        select: {
          filmOfCinema: {
            include: {
              film: true,
            },
          },
        },
      }),
    );
  }
}
