import { Inject, Injectable } from '@nestjs/common';
import { EVENT_NAME, QUEUE_NAME } from '../email/constant/event.type';
import { ClientProxy } from '@nestjs/microservices';
import { SyncCinemaShowtimeDto } from './dto/sync.cinema.showtime.dto';
import { SyncCinemaDetailDto } from './dto/sync.cinema.detail.dto';

@Injectable()
export class EventCronJobWorkerService {
  constructor(
    @Inject(QUEUE_NAME.SYNC_DATE_SERVICE)
    private readonly clientProxy: ClientProxy,
  ) {}

  callSyncDataWithCinemaDetail(dto: SyncCinemaDetailDto) {
    this.clientProxy.emit(EVENT_NAME.DETAIL_CINEMA, dto);
  }

  callSyncDataWithCinemaShowTime(dto: SyncCinemaShowtimeDto) {
    this.clientProxy.emit(EVENT_NAME.CINEMA_SHOWTIME, dto);
  }
}
