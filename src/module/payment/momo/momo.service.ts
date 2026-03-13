import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MomoClient, MomoClientConfig } from '@andev2005/momo-sdk';
import { RedisLockService } from '../../../background/redis/redis.lock.service';
@Injectable()
export class MomoService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisLockService: RedisLockService,
  ) {}

  private createMomoConfig(): MomoClientConfig {
    return {
      accessKey: this.configService.getOrThrow<string>('MOMO_ACCESS_KEY'),
      partnerCode: this.configService.getOrThrow<string>('MOMO_PARTNER_CODE'),
      secretKey: this.configService.getOrThrow<string>('MOMO_SECRET_KEY'),
      env: this.configService.getOrThrow<string>('MOMO_ENV') as
        | 'production'
        | 'sandbox'
        | undefined,
      baseUrl: this.configService.getOrThrow<string>('MOMO_BASE_URL'),
      timeoutMs: this.configService.getOrThrow<number>('MOMO_TIMEOUT_MS'),
    };
  }

  createMomoClient() {
    const config = this.createMomoConfig();
    return new MomoClient(config);
  }

  onModuleInit() {
    this.createMomoClient();
  }
}
