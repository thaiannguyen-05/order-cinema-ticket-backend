import { Injectable, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaReplicaService } from '../prisma/prisma-replica.service';
import { ReplicaFailoverService } from '../prisma/replica-failover.service';
import { MetricsService } from './metrics.service';

/**
 * Probes leader + streaming follower every 10s and exposes:
 * - app_db_replica_up{instance="leader"|"follower"}
 * - app_db_replica_lag_seconds{role="follower"}
 *
 * Lag source: follower's pg_last_xact_replay_timestamp().
 * Probe results also feed ReplicaFailoverService so the fallback circuit
 * opens even without user traffic. Both probes must never throw.
 */
@Injectable()
export class ReplicaMetricsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly replica: PrismaReplicaService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly failover?: ReplicaFailoverService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async probe(): Promise<void> {
    await this.probeLeader();
    await this.probeFollower();
  }

  private async probeLeader(): Promise<void> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      this.metrics?.setReplicaUp('leader', 1);
    } catch {
      this.metrics?.setReplicaUp('leader', 0);
    }
  }

  private async probeFollower(): Promise<void> {
    try {
      const rows = await this.replica.$queryRaw<{ lag_seconds: number }[]>`
        SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) AS "lag_seconds"
      `;
      const lag = Number(rows?.[0]?.lag_seconds);
      this.metrics?.setReplicaUp('follower', 1);
      this.failover?.onSuccess();
      if (Number.isFinite(lag)) {
        this.metrics?.setReplicaLag(lag);
        this.metrics?.incReplicaRead('replica', 'probe', 'success');
      }
    } catch {
      this.metrics?.setReplicaUp('follower', 0);
      this.failover?.onFailure();
      this.metrics?.incReplicaRead('replica', 'probe', 'error');
    }
  }
}
