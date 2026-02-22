import { Module } from '@nestjs/common';
import { SyncDataCronJobService } from './sync-data-cron-job.service';
import { SyncDataCronJobController } from './sync-data-cron-job.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [SyncDataCronJobController],
  providers: [SyncDataCronJobService],
})
export class SyncDataCronJobModule {}
