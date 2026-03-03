import {
  createMovieGluClient,
  type MovieGluSdk,
} from '@andev2005/movie-glu-sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { MyLogger } from '../../logger/logger.service';
import { CinemaService } from '../../module/cinema/cinema.service';
import { RedisLockService } from '../redis/redis.lock.service';
import { REDIS_LOCK_KEY, REDIS_TTL } from '../redis/redis.value';
import { SyncCinemaDetailDto } from './dto/sync.cinema.detail.dto';
import { SyncCinemaShowtimeDto } from './dto/sync.cinema.showtime.dto';
import { UpdateCinemaDto } from '../../module/cinema/dto/update-cinema.dto';
import { EventCronJobWorkerService } from './event.cron-job.worker';

type IpApiResponse = {
  status: 'success' | 'fail';
  lat?: number;
  lon?: number;
  message?: string;
};

type PublicIpResponse = {
  ip: string;
};

@Injectable()
export class SyncDataCronJobService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: MyLogger,
    private readonly cinemaService: CinemaService,
    private readonly redisLockService: RedisLockService,
    private readonly eventCronJobService: EventCronJobWorkerService,
  ) {}

  private createMovieGluClientAtCall(
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

  private sanitizeIpAddress(rawIp: string): string {
    const firstIp = rawIp.split(',')[0]?.trim() ?? '';

    return firstIp.replace(/^::ffff:/, '');
  }

  private isPrivateIpAddress(ipAddress: string): boolean {
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

  private async getServerPublicIp(): Promise<string> {
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

  @Cron('0 0 */2 * * *')
  async syncDataCinemaNearBy(): Promise<void> {
    const lockResult = await this.redisLockService.runExclusive<void>(
      REDIS_LOCK_KEY.CINEMA_NERBY,
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        const deviceDatetime = new Date().toISOString();
        const userIp = await this.getServerPublicIp();
        const geolocation = await this.getGeolocationByUserIp(userIp);
        const client = this.createMovieGluClientAtCall(
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
}
