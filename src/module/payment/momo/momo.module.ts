import { Module } from '@nestjs/common';
import { MomoService } from './momo.service';
import { MomoController } from './momo.controller';
import { RedisModule } from '../../../background/redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [MomoController],
  providers: [MomoService],
})
export class MomoModule {}
