import { Controller } from '@nestjs/common';
import { SyncDataCronJobService } from './sync-data-cron-job.service';

@Controller('sync-data-cron-job')
export class SyncDataCronJobController {
  constructor(
    private readonly syncDataCronJobService: SyncDataCronJobService,
  ) {}
}
