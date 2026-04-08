import { Controller, ServiceUnavailableException } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import {
  RETRY_VALUES,
  retryCore,
  RetryCoreOptions,
} from '../../core/interfaces/re-try.interface';
import { EVENT_NAME } from '../email/constant/event.type';
import { CallMovieGluService } from './call-movie-glu.service';
import type { SyncCinemaDetailDto } from './dto/sync.cinema.detail.dto';
import type { SyncCinemaShowtimeDto } from './dto/sync.cinema.showtime.dto';

@Controller()
export class SyncDateCronJobConsumer {
  constructor(private readonly callMovieGluService: CallMovieGluService) {}

  private readonly optionsRetry: RetryCoreOptions = {
    maxRetryTimes: RETRY_VALUES.MAX_RETRY_TIMES,
    backoffMultiplier: RETRY_VALUES.BACKOFF_MUL,
    baseDelayMs: RETRY_VALUES.BASE_DELAY_MS,
    maxDelayMs: RETRY_VALUES.MAX_DELAY_MS,
  };

  @EventPattern(EVENT_NAME.DETAIL_CINEMA)
  async handleSyncEventCinemaDetail(
    @Payload() dto: SyncCinemaDetailDto,
    @Ctx() context: RmqContext,
  ) {
    const message = context.getMessage();
    const channel = context.getChannelRef();

    try {
      await retryCore(async () => {
        await this.callMovieGluService.syncDataCinemaDetail(dto);
      }, this.optionsRetry);
      channel.ack(message);
    } catch {
      channel.nack(message, false, false);
      throw new ServiceUnavailableException(
        'Event service is temporarily unavailable',
      );
    }
  }

  @EventPattern(EVENT_NAME.CINEMA_SHOWTIME)
  async handleSyncEventCinemaShowtime(
    @Payload() dto: SyncCinemaShowtimeDto,
    @Ctx() context: RmqContext,
  ) {
    const message = context.getMessage();
    const channel = context.getChannelRef();

    try {
      await retryCore(async () => {
        await this.callMovieGluService.syncDataCinemaShowtime(dto);
      }, this.optionsRetry);
      channel.ack(message);
    } catch {
      channel.nack(message, false, false);
      throw new ServiceUnavailableException(
        'Event service is temporarily unavailable',
      );
    }
  }

  @EventPattern(EVENT_NAME.FILM_SHOWTIME)
  async handleSyncEventFilmShowtime(
    @Payload() dto: SyncCinemaShowtimeDto,
    @Ctx() context: RmqContext,
  ) {
    const message = context.getMessage();
    const channel = context.getChannelRef();

    try {
      await retryCore(async () => {
        await this.callMovieGluService.syncDateFilmsOfCinema(dto);
      }, this.optionsRetry);
      channel.ack(message);
    } catch {
      channel.nack(message, false, false);
      throw new ServiceUnavailableException(
        'Event service is temporarily unavailable',
      );
    }
  }
}
