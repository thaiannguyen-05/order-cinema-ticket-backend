import { GluClient } from '@ticket-order-system/movie-sdk';
import type {
  CinemaDetails,
  CinemaNearby,
  CinemaShowTimesResponse,
  FilmDetails,
} from '@ticket-order-system/movie-sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import type { IpApiResponse, PublicIpResponse } from './type/type';
import { MyLogger } from '../../module/core-module/infra/logger/logger.service';

@Injectable()
export class CallMovieGluService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: MyLogger,
  ) {}

  createGluClientAtCall(
    deviceDatetime: string,
    geolocation: string,
  ): GluClient {
    return new GluClient({
      baseUrl:
        this.configService.get<string>('GLU_BASE_URL') ??
        'https://api-gate2.movieglu.com',
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
        `https://ip-api.com/json/${encodeURIComponent(ipAddress)}`,
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

  async cinemaDetail(params: {
    cinema_id: number;
    deviceDatetime: string;
    geolocation: string;
  }): Promise<CinemaDetails> {
    this.logger.debug(`Start cinemaDetail with cinema_id=${params.cinema_id}`);

    const client = this.createGluClientAtCall(
      params.deviceDatetime,
      params.geolocation,
    );
    const detail = await client.cinemas.details({
      cinema_id: params.cinema_id,
    });

    this.logger.debug(
      `Completed cinemaDetail with cinema_id=${params.cinema_id}`,
    );
    return detail;
  }

  async filmDetail(params: {
    film_id: number;
    deviceDatetime: string;
    geolocation: string;
  }): Promise<FilmDetails> {
    this.logger.debug(`Start filmDetail with film_id=${params.film_id}`);

    const client = this.createGluClientAtCall(
      params.deviceDatetime,
      params.geolocation,
    );
    const detail = await client.films.details({
      film_id: params.film_id,
    });

    this.logger.debug(`Completed filmDetail with film_id=${params.film_id}`);
    return detail;
  }

  async cinemaShowTimes(params: {
    cinema_id: number;
    date: string;
    film_id?: number;
    sort?: 'popularity' | 'alphabetical';
    deviceDatetime: string;
    geolocation: string;
  }): Promise<CinemaShowTimesResponse> {
    this.logger.debug(
      `Start cinemaShowTimes with cinema_id=${params.cinema_id} date=${params.date}`,
    );

    const client = this.createGluClientAtCall(
      params.deviceDatetime,
      params.geolocation,
    );
    const response = await client.cinemas.showTimes({
      cinema_id: params.cinema_id,
      date: params.date,
      ...(params.film_id !== undefined && { film_id: params.film_id }),
      ...(params.sort !== undefined && { sort: params.sort }),
    });

    this.logger.debug(
      `Completed cinemaShowTimes with cinema_id=${params.cinema_id} date=${params.date}. Found ${response.films?.length ?? 0} films`,
    );
    return response;
  }

  async cinemaNearby(params: {
    deviceDatetime: string;
    geolocation: string;
    n?: number;
  }): Promise<CinemaNearby[]> {
    this.logger.debug(`Start cinemaNearby with n=${params.n ?? 'default'}`);

    const client = this.createGluClientAtCall(
      params.deviceDatetime,
      params.geolocation,
    );
    const cinemas = await client.cinemas.nearby({
      ...(params.n !== undefined && { n: params.n }),
    });

    this.logger.debug(
      `Completed cinemaNearby. Found ${cinemas.length} cinemas`,
    );
    return cinemas;
  }
}
