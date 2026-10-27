import { nowDeviceDateTime } from '@ticket-order-system/movie-sdk';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CinemaService } from '../../module/theater-module/cinema/cinema.service';
import { CallMovieGluService } from './call-movie-glu.service';
import { MyLogger } from '../../module/core-module/infra/logger/logger.service';
import { PrismaService } from '../../module/core-module/infra/prisma/prisma.service';
import { RedisLockService } from '../../module/core-module/infra/redis/redis.lock.service';
import {
  REDIS_LOCK_KEY,
  REDIS_TTL,
} from '../../module/core-module/infra/redis/redis.value';
import { MetricsService } from '../../module/core-module/infra/metrics/metrics.service';

@Injectable()
export class SyncDataCronJobService {
  constructor(
    private readonly logger: MyLogger,
    private readonly cinemaService: CinemaService,
    private readonly redisLockService: RedisLockService,
    private readonly callMovieGluService: CallMovieGluService,
    private readonly prismaService: PrismaService,
    private readonly metrics?: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncDataFromGlu(): Promise<void> {
    const stopTimer = this.metrics?.cronStart('sync_data_glu');
    let upsertedTotal = 0;
    let filmDetailTotal = 0;
    let showtimeTotal = 0;
    try {
      const lockResult = await this.redisLockService.runExclusive<void>(
        REDIS_LOCK_KEY.CINEMA_NERBY,
        REDIS_TTL.LOCK_SERVICE,
        async () => {
          this.logger.debug('Start syncDataFromGlu with cinemaNearby');

          const deviceDatetime = nowDeviceDateTime();
          const serverIp = await this.callMovieGluService.getServerPublicIp();
          const geolocation =
            await this.callMovieGluService.getGeolocationByUserIp(serverIp);

          const cinemas = await this.callMovieGluService.cinemaNearby({
            deviceDatetime,
            geolocation,
          });

          this.logger.debug(
            `Fetched ${cinemas.length} nearby cinemas from Glu`,
          );

          let upsertedCount = 0;
          for (const cinema of cinemas) {
            try {
              const detail = await this.callMovieGluService.cinemaDetail({
                cinema_id: cinema.cinema_id,
                deviceDatetime,
                geolocation,
              });

              await this.cinemaService.upsertCinema({
                cinema_id: detail.cinema_id,
                cinema_name: detail.cinema_name,
                address: detail.address,
                ...(detail.address2 && { address2: detail.address2 }),
                city: detail.city,
                ...(detail.country && { country: detail.country }),
                postcode: detail.postcode,
                ...(detail.phone && { phone: detail.phone }),
                logo_url: detail.logo_url,
              });
              upsertedCount += 1;
            } catch (error) {
              this.logger.warn(
                `Failed to sync detail for cinema_id=${cinema.cinema_id}: ${(error as Error)?.message ?? error}`,
              );
            }
          }

          this.logger.debug(
            `Upserted ${upsertedCount}/${cinemas.length} cinemas from detail`,
          );

          const showDate = deviceDatetime.slice(0, 10);
          let showtimeCount = 0;
          let filmDetailCount = 0;
          for (const cinema of cinemas) {
            try {
              const showtimes = await this.callMovieGluService.cinemaShowTimes({
                cinema_id: cinema.cinema_id,
                date: showDate,
                deviceDatetime,
                geolocation,
              });

              const dbCinema = await this.cinemaService.getCinema(
                cinema.cinema_id,
              );
              if (!dbCinema) continue;

              let room = await this.prismaService.room.findFirst({
                where: { cinemaId: dbCinema.id },
              });
              if (!room) {
                room = await this.prismaService.room.create({
                  data: { cinemaId: dbCinema.id },
                });
              }

              for (const film of showtimes.films ?? []) {
                let dbFilm = await this.prismaService.film.upsert({
                  where: { film_id: film.film_id },
                  update: {
                    film_name: film.film_name,
                    other_titles: film.other_titles
                      ? JSON.stringify(film.other_titles)
                      : null,
                    age_rating: film.age_rating as unknown as object,
                    synopsis_long: film.synopsis_long,
                    images: film.images as unknown as object,
                  },
                  create: {
                    film_id: film.film_id,
                    imdb_id: film.imdb_id,
                    film_name: film.film_name,
                    other_titles: film.other_titles
                      ? JSON.stringify(film.other_titles)
                      : null,
                    age_rating: film.age_rating as unknown as object,
                    synopsis_long: film.synopsis_long,
                    images: film.images as unknown as object,
                  },
                });

                try {
                  const fullDetail = await this.callMovieGluService.filmDetail({
                    film_id: film.film_id,
                    deviceDatetime,
                    geolocation,
                  });
                  dbFilm = await this.prismaService.film.update({
                    where: { id: dbFilm.id },
                    data: {
                      film_name: fullDetail.film_name,
                      other_titles: fullDetail.other_titles
                        ? JSON.stringify(fullDetail.other_titles)
                        : null,
                      release_dates:
                        fullDetail.release_dates as unknown as object,
                      age_rating: fullDetail.age_rating as unknown as object,
                      film_trailer:
                        typeof fullDetail.trailers === 'string'
                          ? fullDetail.trailers
                          : undefined,
                      synopsis_long: fullDetail.synopsis_long,
                      images: fullDetail.images as unknown as object,
                    },
                  });
                  filmDetailCount += 1;
                } catch (error) {
                  this.logger.warn(
                    `Failed to enrich film detail for film_id=${film.film_id}: ${(error as Error)?.message ?? error}`,
                  );
                }

                const filmOfCinema =
                  await this.prismaService.filmOfCinema.upsert({
                    where: {
                      filmId_cinemaId: {
                        filmId: dbFilm.id,
                        cinemaId: dbCinema.id,
                      },
                    },
                    update: {},
                    create: {
                      filmId: dbFilm.id,
                      cinemaId: dbCinema.id,
                    },
                  });

                const dayStart = new Date(`${showDate}T00:00:00`);
                const nextDay = new Date(dayStart);
                nextDay.setDate(nextDay.getDate() + 1);
                await this.prismaService.showTime.deleteMany({
                  where: {
                    filmId: filmOfCinema.id,
                    startAt: { gte: dayStart, lt: nextDay },
                  },
                });

                for (const showing of Object.values(film.showings ?? {})) {
                  for (const slot of showing.times ?? []) {
                    const [hourStr, minuteStr] = slot.start_time.split(':');
                    const hour = Number(hourStr);
                    const minute = Number(minuteStr);
                    if (Number.isNaN(hour) || Number.isNaN(minute)) continue;
                    const startAt = new Date(
                      `${showDate}T${slot.start_time}:00`,
                    );
                    if (hour < 3) startAt.setDate(startAt.getDate() + 1);
                    const durationMins =
                      typeof film.duration_mins === 'number'
                        ? film.duration_mins
                        : 120;
                    const endAt = new Date(
                      startAt.getTime() + durationMins * 60_000,
                    );

                    await this.prismaService.showTime.create({
                      data: {
                        filmId: filmOfCinema.id,
                        roomId: room.id,
                        startAt,
                        endAt,
                        basedPrice: 0,
                      },
                    });
                    showtimeCount += 1;
                  }
                }
              }
            } catch (error) {
              this.logger.warn(
                `Failed to sync showtimes for cinema_id=${cinema.cinema_id}: ${(error as Error)?.message ?? error}`,
              );
            }
          }

          this.logger.debug(
            `Synced ${showtimeCount} showtimes and enriched ${filmDetailCount} film details for date ${showDate}`,
          );
          upsertedTotal = upsertedCount;
          filmDetailTotal = filmDetailCount;
          showtimeTotal = showtimeCount;
        },
      );

      if (lockResult === null) {
        this.logger.debug('Skip syncDataFromGlu because lock is already held');
        this.metrics?.cronSkipped('sync_data_glu');
      } else {
        this.metrics?.cronSuccess('sync_data_glu');
        this.metrics?.addSyncCounts(
          upsertedTotal,
          filmDetailTotal,
          showtimeTotal,
        );
      }
    } catch (error) {
      this.metrics?.cronFailed('sync_data_glu');
      throw error;
    } finally {
      stopTimer?.();
    }
  }
}
