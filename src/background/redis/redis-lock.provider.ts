// redis-lock.provider.ts
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { REDIS_LOCK_CLIENT } from './redis.value';

export const RedisLockProvider = {
  provide: REDIS_LOCK_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const client = new Redis(
      `redis://localhost:${config.getOrThrow<string>('REDIS_PORT')}`,
    );
    // Prevent noisy unhandled error events while waiting for Redis startup.
    client.on('error', () => {});
    return client;
  },
};
