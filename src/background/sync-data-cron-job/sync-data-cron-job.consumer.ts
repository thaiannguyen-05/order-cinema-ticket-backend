import { Controller } from '@nestjs/common';
import { SyncDataCronJobService } from './sync-data-cron-job.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EVENT_NAME } from '../email/constant/event.type';
import type { SyncCinemaDetailDto } from './dto/sync.cinema.detail.dto';
import type { SyncCinemaShowtimeDto } from './dto/sync.cinema.showtime.dto';

@Controller()
export class SyncDateCronJobConsumer {
  constructor(
    private readonly syncDateCronJobService: SyncDataCronJobService,
  ) {}

  @EventPattern(EVENT_NAME.DETAIL_CINEMA)
  async handleSyncEventCinemaDetail(@Payload() dto: SyncCinemaDetailDto) {
    await this.syncDateCronJobService.syncDataCinemaDetail(dto);
  }

  @EventPattern(EVENT_NAME.CINEMA_SHOWTIME)
  async handleSyncEventCinemaShowtime(@Payload() dto: SyncCinemaShowtimeDto) {
    await this.syncDateCronJobService.syncDataCinemaShowtime(dto);
  }
}
