import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Read-only client pointed at the streaming-replica (follower).
 * Falls back to DATABASE_URL when DATABASE_URL_REPLICA is not set
 * (unit tests, dev without replica) so callers never break.
 */
@Injectable()
export class PrismaReplicaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    const replicaUrl = configService.get<string>('DATABASE_URL_REPLICA');
    const connectionString =
      replicaUrl ?? configService.getOrThrow<string>('DATABASE_URL');

    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
