import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

type ThrottlerRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

// Redis-backed throttler storage for distributed rate limiting.
// Replaces the default in-memory Map so N replicas share buckets.
// ttl / blockDuration are in milliseconds (throttler v6 contract).
// Returns timeToExpire / timeToBlockExpire in seconds (guard contract).
@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly redis: Redis;
  private readonly prefix = 'throttle:';

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.getOrThrow<string>('REDIS_PORT');
    this.redis = new Redis(`redis://${host}:${port}`, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
    this.redis.on('error', () => {});
  }

  private countKey(key: string, name: string): string {
    return `${this.prefix}${name}:${key}`;
  }

  private blockKey(key: string, name: string): string {
    return `${this.prefix}${name}:${key}:blocked`;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerRecord> {
    const countKey = this.countKey(key, throttlerName);
    const blockKey = this.blockKey(key, throttlerName);
    const ttlMs = Math.max(1, ttl);
    const blockMs = Math.max(1, blockDuration || ttl);

    try {
      const blockedTtl = await this.redis.pttl(blockKey);
      if (blockedTtl > 0) {
        const count = Number((await this.redis.get(countKey)) ?? 0);
        const expireMs = await this.redis.pttl(countKey);
        return {
          totalHits: Number.isFinite(count) ? count : limit + 1,
          timeToExpire: Math.ceil(Math.max(0, expireMs) / 1000),
          isBlocked: true,
          timeToBlockExpire: Math.ceil(blockedTtl / 1000),
        };
      }

      const totalHits = await this.redis.incr(countKey);
      if (totalHits === 1) {
        await this.redis.pexpire(countKey, ttlMs);
      }
      const expireMs = await this.redis.pttl(countKey);
      const timeToExpire = Math.ceil(Math.max(0, expireMs) / 1000);

      if (totalHits > limit) {
        await this.redis.psetex(blockKey, blockMs, '1');
        return {
          totalHits,
          timeToExpire,
          isBlocked: true,
          timeToBlockExpire: Math.ceil(blockMs / 1000),
        };
      }

      return {
        totalHits,
        timeToExpire,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch {
      // Fail-open if Redis is down so throttling never takes the app down.
      // DDoS protection degrades to per-instance only in this window.
      return {
        totalHits: 0,
        timeToExpire: Math.ceil(ttlMs / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // ignore
    }
  }
}
