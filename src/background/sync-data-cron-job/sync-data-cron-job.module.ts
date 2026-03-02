import { Module } from '@nestjs/common';
import { SyncDataCronJobService } from './sync-data-cron-job.service';
import { TheaterModule } from '../../module/theater/theater.module';

@Module({
  imports: [TheaterModule],
  controllers: [],
  providers: [SyncDataCronJobService],
})
export class SyncDataCronJobModule {}
