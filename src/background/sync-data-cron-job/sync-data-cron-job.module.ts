import { Module } from '@nestjs/common';
import { SyncDataCronJobService } from './sync-data-cron-job.service';
import { CallMovieGluService } from './call-movie-glu.service';
import { CinemaModule } from '../../module/theater-module/cinema/cinema.module';
import { RedisModule } from '../../module/core-module/infra/redis/redis.module';

@Module({
  imports: [CinemaModule, RedisModule],
  providers: [SyncDataCronJobService, CallMovieGluService],
})
export class SyncDataCronJobModule {}
