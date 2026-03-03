import { Inject, Injectable } from '@nestjs/common';
import Redlock from 'redlock';
import { REDIS_LOCK_CLIENT } from './redis.value';
import Redis from 'ioredis';

@Injectable()
export class RedisLockService {
  private redisLock: Redlock;

  constructor(@Inject(REDIS_LOCK_CLIENT) private readonly redis: Redis) {
    this.redisLock = new Redlock(
      [this.redis as unknown as Redlock.CompatibleRedisClient],
      {
        retryCount: 5,
      },
    );

    this.redisLock.on('clientError', () => {});
  }

  async runExclusive<T>(
    resource: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    let lock: Redlock.Lock | null = null;
    try {
      lock = await this.redisLock.acquire([resource], ttlMs);
    } catch {
      return null;
    }

    try {
      return await fn();
    } finally {
      if (lock) {
        await this.redisLock.release(lock).catch(() => undefined);
      }
    }
  }
}
