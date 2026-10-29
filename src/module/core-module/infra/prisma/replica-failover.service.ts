import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Circuit-breaker for the follower fallback.
 *
 * Closed (default): leader read failures may fall back to the follower.
 * Open: follower fallback is skipped for `cooldownMs`, leader errors throw
 * directly.
 *
 * State is driven by follower fallback failures (see runRead helpers in
 * cinema/film/seat services) plus the 10s probe in ReplicaMetricsService.
 * No timers or retry loops — just a timestamp gate, so a dead follower
 * cannot cause a hot loop.
 */
@Injectable()
export class ReplicaFailoverService {
  private consecutiveFailures = 0;
  private openUntil = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;

  constructor(@Optional() config?: ConfigService) {
    const threshold = Number(
      config?.get<string | number>('REPLICA_FAILOVER_THRESHOLD') ?? 3,
    );
    const cooldown = Number(
      config?.get<string | number>('REPLICA_FAILOVER_COOLDOWN_MS') ?? 30000,
    );
    this.threshold =
      Number.isFinite(threshold) && threshold > 0 ? Math.floor(threshold) : 3;
    this.cooldownMs =
      Number.isFinite(cooldown) && cooldown > 0 ? Math.floor(cooldown) : 30000;
  }

  /** True when leader failures may fall back to the follower. False during cooldown. */
  useReplica(): boolean {
    return Date.now() >= this.openUntil;
  }

  onSuccess(): void {
    this.consecutiveFailures = 0;
  }

  onFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.threshold) {
      this.openUntil = Date.now() + this.cooldownMs;
      this.consecutiveFailures = 0;
    }
  }

  /** Test/debug helper. */
  reset(): void {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
  }
}
