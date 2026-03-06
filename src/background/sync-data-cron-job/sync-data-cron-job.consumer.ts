import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EVENT_NAME } from '../email/constant/event.type';
import { CallMovieGluService } from './call-movie-glu.service';
import type { SyncCinemaDetailDto } from './dto/sync.cinema.detail.dto';
import type { SyncCinemaShowtimeDto } from './dto/sync.cinema.showtime.dto';

@Controller()
export class SyncDateCronJobConsumer {
  constructor(private readonly callMovieGluService: CallMovieGluService) {}

  @EventPattern(EVENT_NAME.DETAIL_CINEMA)
  async handleSyncEventCinemaDetail(@Payload() dto: SyncCinemaDetailDto) {
    await this.callMovieGluService.syncDataCinemaDetail(dto);
  }

  @EventPattern(EVENT_NAME.CINEMA_SHOWTIME)
  async handleSyncEventCinemaShowtime(@Payload() dto: SyncCinemaShowtimeDto) {
    await this.callMovieGluService.syncDataCinemaShowtime(dto);
  }
}
