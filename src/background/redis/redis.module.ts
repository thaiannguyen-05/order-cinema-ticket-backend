import { createKeyv } from '@keyv/redis';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        stores: [
          createKeyv(
            `redis://localhost:${configService.getOrThrow<string>('REDIS_PORT')}`,
          ),
        ],
      }),
      isGlobal: true,
    }),
  ],
  providers: [
    RedisService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
