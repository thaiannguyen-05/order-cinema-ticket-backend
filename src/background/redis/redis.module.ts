import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ConfigService } from '@nestjs/config';
import { RedisLockProvider } from './redis-lock.provider';
import { RedisLockService } from './redis.lock.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        stores: [
          createKeyv(
            `redis://${configService.get<string>('REDIS_HOST', 'localhost')}:${configService.getOrThrow<string>('REDIS_PORT')}`,
          ),
        ],
      }),
      isGlobal: true,
    }),
  ],
  providers: [RedisService, RedisLockProvider, RedisLockService],
  exports: [RedisService, RedisLockProvider, RedisLockService],
})
export class RedisModule {}
