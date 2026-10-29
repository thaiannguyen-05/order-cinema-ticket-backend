import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { PrismaReplicaService } from '../../core-module/infra/prisma/prisma-replica.service';
import { ReplicaFailoverService } from '../../core-module/infra/prisma/replica-failover.service';
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
    @Optional() private readonly failover?: ReplicaFailoverService,
  ) {}

  /**
   * Leader-first with follower fallback: try leader, on error retry once on
   * follower. When the circuit is open, skip the follower fallback entirely.
   */
  private async runRead<T>(
    target: 'seat',
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
    return this.runRead('seat', (db) =>
      db.seat.findUnique({
        where: {
          id: seatId,
        },
      }),
    );
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
      const [total, seats] = await this.runRead('seat', (db) =>
        Promise.all([
          db.seat.count({ where }),
          db.seat.findMany({
            where,
            take: limit,
            skip: (page - 1) * limit,
            orderBy: { id: 'asc' },
          }),
        ]),
      );

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
    return this.runRead('seat', (db) =>
      db.seat.findMany({
        where: {
          roomId,
        },
        orderBy: { id: 'asc' },
      }),
    );
  }
}
