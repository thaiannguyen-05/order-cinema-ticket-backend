// redis-lock.provider.ts
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { REDIS_LOCK_CLIENT } from './redis.value';

export const RedisLockProvider = {
  provide: REDIS_LOCK_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return new Redis(
      `redis://localhost:${config.getOrThrow<string>('REDIS_PORT')}`,
    );
  },
};
