import { createMovieGluClient, MovieGluSdk } from '@andev2005/movie-glu-sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MyLogger } from '../../logger/logger.service';
import { CinemaService } from '../../module/theater-module/cinema/cinema.service';
import { UpdateCinemaDto } from '../../module/theater-module/cinema/dto/update-cinema.dto';
import { FilmService } from '../../module/theater-module/film/film.service';
import { RedisLockService } from '../redis/redis.lock.service';
import { REDIS_LOCK_KEY, REDIS_TTL } from '../redis/redis.value';
import { SyncCinemaDetailDto } from './dto/sync.cinema.detail.dto';
import { SyncCinemaShowtimeDto } from './dto/sync.cinema.showtime.dto';
import { SyncFilmsDetailDto } from './dto/sync.films.detail.dto';
import { EventCronJobWorkerService } from './event.cron-job.worker';
import { UpdateFilmDto } from '../../module/theater-module/film/dto/update-film.dto';
import { IpApiResponse, PublicIpResponse } from './type';
import { SyncFilmsShowtimeDto } from './dto/sync.films.showtime.dto';
import { Film as PrismaFilm } from '@prisma/client';

@Injectable()
export class CallMovieGluService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: MyLogger,
    private readonly cinemaService: CinemaService,
    private readonly redisLockService: RedisLockService,
    private readonly eventCronJobService: EventCronJobWorkerService,
    private readonly filmService: FilmService,
  ) {}

  createMovieGluClientAtCall(
    deviceDatetime: string,
    geolocation: string,
  ): MovieGluSdk {
    return createMovieGluClient({
      apiKey: this.configService.getOrThrow<string>('MOVIE_GLU_APIKEY'),
      headers: {
        client: this.configService.getOrThrow<string>('GLU_CLIENT'),
        'x-api-key': this.configService.getOrThrow<string>('MOVIE_GLU_APIKEY'),
        authorization:
          this.configService.getOrThrow<string>('GLU_AUTHORIZATION'),
        territory: this.configService.getOrThrow<string>('GLU_TERRITORY'),
        'api-version': this.configService.getOrThrow<string>('GLU_API_VER'),
        geolocation,
        'device-datetime': deviceDatetime,
      },
    });
  }

  sanitizeIpAddress(rawIp: string): string {
    const firstIp = rawIp.split(',')[0]?.trim() ?? '';

    return firstIp.replace(/^::ffff:/, '');
  }

  isPrivateIpAddress(ipAddress: string): boolean {
    if (!ipAddress) return true;

    return (
      ipAddress === '127.0.0.1' ||
      ipAddress === '::1' ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ipAddress) ||
      ipAddress.startsWith('fc') ||
      ipAddress.startsWith('fd') ||
      ipAddress.startsWith('fe80:')
    );
  }

  async getServerPublicIp(): Promise<string> {
    try {
      const { data } = await axios.get<PublicIpResponse>(
        'https://api.ipify.org',
        {
          params: { format: 'json' },
          timeout: 5000,
        },
      );

      return this.sanitizeIpAddress(data.ip);
    } catch {
      this.logger.warn('Failed to resolve server public IP');
      return '';
    }
  }

  async getGeolocationByUserIp(userIp: string): Promise<string> {
    const fallbackGeolocation = '-22.0;14.0';
    const ipAddress = this.sanitizeIpAddress(userIp);

    if (this.isPrivateIpAddress(ipAddress)) {
      return fallbackGeolocation;
    }

    try {
      const { data } = await axios.get<IpApiResponse>(
        `http://ip-api.com/json/${encodeURIComponent(ipAddress)}`,
        {
          params: { fields: 'status,message,lat,lon' },
          timeout: 5000,
        },
      );

      if (
        data.status !== 'success' ||
        typeof data.lat !== 'number' ||
        typeof data.lon !== 'number'
      ) {
        this.logger.warn(
          `Cannot resolve geolocation from IP ${ipAddress}: ${data.message ?? 'unknown error'}`,
        );
        return fallbackGeolocation;
      }

      return `${data.lat};${data.lon}`;
    } catch {
      this.logger.warn(`Failed to get geolocation from IP ${ipAddress}`);
      return fallbackGeolocation;
    }
  }

  async syncDataCinemaDetail(dto: SyncCinemaDetailDto): Promise<void> {
    const lockResult = await this.redisLockService.runExclusive<void>(
      REDIS_LOCK_KEY.CINEMA_DETAIL,
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        this.logger.debug(
          `Start syncDataCinemaDetail with ${dto.cinemas.length} cinemas`,
        );

        let updatedCount = 0;
        for (const cinema of dto.cinemas) {
          this.logger.debug(
            `Updating cinema detail for ID ${cinema.cinema_id}`,
          );

          const updateCinemaDto: UpdateCinemaDto = {
            address: cinema.address,
            ...(cinema.address2 && { address2: cinema.address2 }),
            ...(cinema.cinema_name && { cinema_name: cinema.cinema_name }),
            ...(cinema.city && { city: cinema.city }),
            ...(cinema.country && { country: cinema.country }),
            ...(cinema.postcode && { postcode: cinema.postcode }),
            ...(cinema.phone && { phone: cinema.phone }),
            ...(cinema.logo_url && { logo_url: cinema.logo_url }),
          };
          await this.cinemaService.updateCinema(
            updateCinemaDto,
            cinema.cinema_id,
          );

          updatedCount += 1;
        }

        this.logger.debug(
          `Completed syncDataCinemaDetail. Updated ${updatedCount} cinemas`,
        );

        const payload: SyncCinemaShowtimeDto = {
          cinemas: dto.cinemas,
          client: dto.client,
          quantity: dto.quantity,
        };
        this.eventCronJobService.callSyncDataWithCinemaShowTime(payload);
      },
    );

    if (lockResult === null) {
      this.logger.debug(
        'Skip syncDataCinemaDetail because lock is already held',
      );
    }
  }

  async syncDataCinemaShowtime(dto: SyncCinemaShowtimeDto): Promise<void> {
    const lockResult = await this.redisLockService.runExclusive<void>(
      REDIS_LOCK_KEY.CINEMA_SHOWTIME,
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        this.logger.debug(
          `Start syncDataCinemaShowtime with ${dto.cinemas.length} cinemas`,
        );

        let updatedCount = 0;
        for (const cinema of dto.cinemas) {
          this.logger.debug(
            `Updating cinema showtime for cinema ID ${cinema.cinema_id}`,
          );

          const updateCinemaDto: UpdateCinemaDto = {
            address: cinema.address,
            ...(cinema.address2 && { address2: cinema.address2 }),
            ...(cinema.cinema_name && { cinema_name: cinema.cinema_name }),
            ...(cinema.city && { city: cinema.city }),
            ...(cinema.country && { country: cinema.country }),
            ...(cinema.postcode && { postcode: cinema.postcode }),
            ...(cinema.phone && { phone: cinema.phone }),
            ...(cinema.logo_url && { logo_url: cinema.logo_url }),
          };
          await this.cinemaService.updateCinema(
            updateCinemaDto,
            cinema.cinema_id,
          );

          updatedCount += 1;
        }

        this.logger.debug(
          `Completed syncDataCinemaShowtime. Updated ${updatedCount} cinemas`,
        );
      },
    );

    if (lockResult === null) {
      this.logger.debug(
        'Skip syncDataCinemaShowtime because lock is already held',
      );
    }
  }

  async updateFilmsDetail(dto: SyncFilmsDetailDto): Promise<void> {
    for (const film of dto.film) {
      const parsedReviewStars =
        typeof film.review_stars === 'string'
          ? Number(film.review_stars)
          : film.review_stars;

      const updateFilmDto: UpdateFilmDto = {
        ...(film.film_name && { film_name: film.film_name }),
        ...(film.other_titles && { other_title: film.other_titles }),
        ...(film.release_dates && { release_dates: film.release_dates }),
        ...(film.age_rating && { age_rating: film.age_rating as never }),
        ...(film.trailers && { trailers: film.trailers as never }),
        ...(film.synopsis_long && { synopsis_long: film.synopsis_long }),
        ...(film.images && { images: film.images as never }),
        ...(film.version_type && { version_type: film.version_type as never }),
        ...(film.duration_mins != null && {
          duration_mins: film.duration_mins,
        }),
        ...(parsedReviewStars != null &&
          !Number.isNaN(parsedReviewStars) && {
            review_stars: parsedReviewStars,
          }),
        ...(film.review_txt && { review_txt: film.review_txt }),
        ...(film.distributor && { distributor: film.distributor }),
        ...(film.genres && { genres: film.genres }),
        ...(film.cast && { cast: film.cast }),
        ...(film.directors && { director: film.directors as never }),
        ...(film.producers && { producers: film.producers }),
        ...(film.writers && { writers: film.writers }),
      };

      await this.filmService.updateFilm(film.film_id, updateFilmDto);
    }
  }

  async syncDateFilmsOfCinema(dto: SyncFilmsShowtimeDto): Promise<void> {
    const processedFilmIds = new Set<number>();

    for (const cinema of dto.cinemas) {
      const filmsShowTime = await this.cinemaService.getFilmsOfCinema(
        cinema.cinema_id,
      );

      for (const cinemaWithFilms of filmsShowTime) {
        for (const filmElement of cinemaWithFilms.filmOfCinema) {
          const film = filmElement.film;
          if (!film) continue;
          if (processedFilmIds.has(film.film_id)) continue;
          processedFilmIds.add(film.film_id);

          const updateFilmDto: UpdateFilmDto = {
            ...(film.film_name && { film_name: film.film_name }),
            ...(film.other_title && { other_title: film.other_title as never }),
            ...(film.release_dates && {
              release_dates: film.release_dates as never,
            }),
            ...(film.age_rating && { age_rating: film.age_rating as never }),
            ...(film.trailers && { trailers: film.trailers as never }),
            ...(film.synopsis_long && { synopsis_long: film.synopsis_long }),
            ...(film.images && { images: film.images as never }),
            ...(film.version_type && {
              version_type: film.version_type as never,
            }),
            ...(film.duration_mins != null && {
              duration_mins: film.duration_mins,
            }),
            ...(film.review_stars != null && {
              review_stars: film.review_stars,
            }),
            ...(film.review_txt && { review_txt: film.review_txt }),
            ...(film.distributor && { distributor: film.distributor }),
            ...(film.genres && { genres: film.genres as never }),
            ...(film.cast && { cast: film.cast as never }),
            ...(film.directors && { director: film.directors as never }),
            ...(film.producers && { producers: film.producers as never }),
            ...(film.writers && { writers: film.writers as never }),
          };

          if (!this.hasFilmChanges(film, updateFilmDto)) continue;

          await this.filmService.updateFilm(film.film_id, updateFilmDto);
        }
      }
    }
  }

  private hasFilmChanges(film: PrismaFilm, dto: UpdateFilmDto): boolean {
    if (dto.film_name !== undefined && dto.film_name !== film.film_name) {
      return true;
    }
    if (
      dto.synopsis_long !== undefined &&
      dto.synopsis_long !== film.synopsis_long
    ) {
      return true;
    }
    if (
      dto.version_type !== undefined &&
      dto.version_type !== film.version_type
    ) {
      return true;
    }
    if (
      dto.duration_mins !== undefined &&
      dto.duration_mins !== film.duration_mins
    ) {
      return true;
    }
    if (
      dto.review_stars !== undefined &&
      dto.review_stars !== film.review_stars
    ) {
      return true;
    }
    if (dto.review_txt !== undefined && dto.review_txt !== film.review_txt) {
      return true;
    }
    if (dto.distributor !== undefined && dto.distributor !== film.distributor) {
      return true;
    }
    if (!this.isSameJsonValue(dto.other_title, film.other_title)) {
      return true;
    }
    if (!this.isSameJsonValue(dto.release_dates, film.release_dates)) {
      return true;
    }
    if (!this.isSameJsonValue(dto.age_rating, film.age_rating)) {
      return true;
    }
    if (!this.isSameJsonValue(dto.trailers, film.trailers)) {
      return true;
    }
    if (!this.isSameJsonValue(dto.images, film.images)) {
      return true;
    }
    if (!this.isSameJsonValue(dto.genres, film.genres)) {
      return true;
    }
    if (!this.isSameJsonValue(dto.cast, film.cast)) {
      return true;
    }
    if (!this.isSameJsonValue(dto.director, film.directors)) {
      return true;
    }
    if (!this.isSameJsonValue(dto.producers, film.producers)) {
      return true;
    }
    if (!this.isSameJsonValue(dto.writers, film.writers)) {
      return true;
    }

    return false;
  }

  private isSameJsonValue(nextValue: unknown, currentValue: unknown): boolean {
    if (nextValue === undefined) return true;
    return JSON.stringify(nextValue) === JSON.stringify(currentValue);
  }
}
