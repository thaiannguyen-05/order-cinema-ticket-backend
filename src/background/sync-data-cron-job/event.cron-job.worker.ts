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

  callSyncDataWithCinemaDetail(dto: SyncCinemaDetailDto): Promise<void> {
    this.clientProxy.emit(EVENT_NAME.DETAIL_CINEMA, dto);
    return Promise.resolve();
  }

  callSyncDataWithCinemaShowTime(dto: SyncCinemaShowtimeDto): Promise<void> {
    this.clientProxy.emit(EVENT_NAME.CINEMA_SHOWTIME, dto);
    return Promise.resolve();
  }

  callSyncDataWithFilmShowTime(dto: SyncCinemaShowtimeDto): Promise<void> {
    this.clientProxy.emit(EVENT_NAME.FILM_SHOWTIME, dto);
    return Promise.resolve();
  }
}
