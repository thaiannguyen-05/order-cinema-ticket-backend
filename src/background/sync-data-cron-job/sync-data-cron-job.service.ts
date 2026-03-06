import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MyLogger } from '../../logger/logger.service';
import { CinemaService } from '../../module/cinema/cinema.service';
import { RedisLockService } from '../redis/redis.lock.service';
import { REDIS_LOCK_KEY, REDIS_TTL } from '../redis/redis.value';
import { CallMovieGluService } from './call-movie-glu.service';
import { SyncCinemaDetailDto } from './dto/sync.cinema.detail.dto';
import { EventCronJobWorkerService } from './event.cron-job.worker';
import { FilmService } from '../../module/film/film.service';

@Injectable()
export class SyncDataCronJobService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: MyLogger,
    private readonly cinemaService: CinemaService,
    private readonly redisLockService: RedisLockService,
    private readonly eventCronJobService: EventCronJobWorkerService,
    private readonly callMovieGluService: CallMovieGluService,
    private readonly filmService: FilmService,
  ) {}

  @Cron(CronExpression.EVERY_2_HOURS)
  async syncDataCinemaNearBy(): Promise<void> {
    const lockResult = await this.redisLockService.runExclusive<void>(
      REDIS_LOCK_KEY.CINEMA_NERBY,
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        const deviceDatetime = new Date().toISOString();
        const userIp = await this.callMovieGluService.getServerPublicIp();
        const geolocation =
          await this.callMovieGluService.getGeolocationByUserIp(userIp);
        const client = this.callMovieGluService.createMovieGluClientAtCall(
          deviceDatetime,
          geolocation,
        );
        const quantity = 100;

        const { cinemas } = await client.cinemas.nearby(
          { limit: quantity },
          {
            headers: {
              geolocation,
              'device-datetime': deviceDatetime,
            },
          },
        );
        this.logger.debug(`Data cinema nearby ${JSON.stringify(cinemas)}`);

        for (const cinema of cinemas) {
          await this.cinemaService.upsertCinema({
            cinema_id: cinema.cinema_id,
            cinema_name: cinema.cinema_name,
            address: cinema.address,
            address2: cinema.address2,
            city: cinema.city,
            country: cinema.country,
            postcode: cinema.postcode,
            phone: cinema.phone,
            logo_url: cinema.logo_url,
          });
        }

        const payload: SyncCinemaDetailDto = {
          cinemas: cinemas,
          client: client,
          quantity: quantity,
        };

        this.eventCronJobService.callSyncDataWithCinemaDetail(payload);
      },
    );

    if (lockResult === null) {
      this.logger.debug(
        'Skip syncDataCinemaNearBy because lock is already held',
      );
    }
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async syncNowShowingFilms() {
    const lockResult = await this.redisLockService.runExclusive<void>(
      REDIS_LOCK_KEY.CINEMA_NOWSHOWING,
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        const deviceDatetime = new Date().toISOString();
        const userIp = await this.callMovieGluService.getServerPublicIp();
        const geolocation =
          await this.callMovieGluService.getGeolocationByUserIp(userIp);
        const client = this.callMovieGluService.createMovieGluClientAtCall(
          deviceDatetime,
          geolocation,
        );
        const quantity = 100;

        const { films } = await client.films.nowShowing({ limit: quantity });
        this.logger.debug(`Data cinema nearby ${JSON.stringify(films)}`);
      },
    );

    if (lockResult === null) {
      this.logger.debug('Skip because lock is already held');
    }
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async syncNowFilmsComingSoon() {
    const lockResult = await this.redisLockService.runExclusive<void>(
      REDIS_LOCK_KEY.CINEMA_NOWSHOWING,
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        const deviceDatetime = new Date().toISOString();
        const userIp = await this.callMovieGluService.getServerPublicIp();
        const geolocation =
          await this.callMovieGluService.getGeolocationByUserIp(userIp);
        const client = this.callMovieGluService.createMovieGluClientAtCall(
          deviceDatetime,
          geolocation,
        );
        const quantity = 100;

        const { films } = await client.films.comingSoon({ limit: quantity });
        this.logger.debug(`Data cinema nearby ${JSON.stringify(films)}`);
      },
    );

    if (lockResult === null) {
      this.logger.debug('Skip because lock is already held');
    }
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async syncFilmsDetails() {
    const lockResult = await this.redisLockService.runExclusive<void>(
      REDIS_LOCK_KEY.CINEMA_FILM_DETAIL,
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        const deviceDatetime = new Date().toISOString();
        const userIp = await this.callMovieGluService.getServerPublicIp();
        const geolocation =
          await this.callMovieGluService.getGeolocationByUserIp(userIp);
        const client = this.callMovieGluService.createMovieGluClientAtCall(
          deviceDatetime,
          geolocation,
        );

        const films = await this.filmService.getAllFilms();

        for (const film of films) {
          const updatedFilm = await client.films.details(film.film_id);
          this.logger.debug(`Data film details ${JSON.stringify(updatedFilm)}`);

          await this.callMovieGluService.updateFilmsDetail({
            film: [updatedFilm],
          });
        }
      },
    );

    if (lockResult === null) {
      this.logger.debug('Skip because lock is already held');
      return;
    }
  }
}
