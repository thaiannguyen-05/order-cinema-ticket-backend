import { Module } from '@nestjs/common';
import { PrismaDatabaseService } from './prisma.database.service';
import { SyncDataCronJobController } from './sync-data-cron-job.controller';
import { SyncDataCronJobService } from './sync-data-cron-job.service';

@Module({
  imports: [],
  controllers: [SyncDataCronJobController],
  providers: [SyncDataCronJobService, PrismaDatabaseService],
})
export class SyncDataCronJobModule {}
