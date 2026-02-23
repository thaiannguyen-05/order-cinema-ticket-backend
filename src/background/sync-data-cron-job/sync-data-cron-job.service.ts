import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { MyLogger } from '../../logger/logger.service';
import { MOVIE_GLU, SortType } from './api.fetch.data';
import {
  CinemaDetailsResponse,
  CinemasNearbyResponse,
  CinemaShowTimesResponse,
  FilmDetailsResponse,
  FilmsComingSoonResponse,
  FilmsNowShowing,
  UserLocation,
} from './api.response.type';
import { PrismaDatabaseService } from './prisma.database.service';
@Injectable()
export class SyncDataCronJobService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: MyLogger,
    private readonly dataBaseService: PrismaDatabaseService,
  ) {}

  resolveUserLocation(
    req: Request,
    feGeo?: { lat?: number; lng?: number },
  ): UserLocation {
    if (
      typeof feGeo?.lat === 'number' &&
      typeof feGeo?.lng === 'number' &&
      feGeo.lat >= -90 &&
      feGeo.lat <= 90 &&
      feGeo.lng >= -180 &&
      feGeo.lng <= 180
    ) {
      return { lat: feGeo.lat, lng: feGeo.lng, source: 'fe' };
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip;

    if (ip) {
      const ipGeo = this.lookupGeoFromIp(ip);
      if (ipGeo) {
        return { ...ipGeo, source: 'ip' };
      }
    }

    return { lat: 10.7769, lng: 106.7009, source: 'default' };
  }

  private lookupGeoFromIp(
    ip: string,
  ): Pick<UserLocation, 'lat' | 'lng'> | null {
    this.logger.debug(
      `IP geolocation lookup is not implemented yet. ip=${ip}`,
      SyncDataCronJobService.name,
    );

    return null;
  }

  private async getCinemaNearBy(
    quantity: number,
    geolocation: string,
  ): Promise<CinemasNearbyResponse> {
    const response = await firstValueFrom(
      this.httpService.get<CinemasNearbyResponse>(
        MOVIE_GLU.CINEMA_NEARBY(quantity),
        {
          headers: {
            geolocation,
          },
        },
      ),
    );

    return response.data;
  }

  private async getFilmsNowShowing(quantity: number): Promise<FilmsNowShowing> {
    const response = await firstValueFrom(
      this.httpService.get<FilmsNowShowing>(
        MOVIE_GLU.FILM_NOWSHOWING(quantity),
      ),
    );

    return response.data;
  }

  private async getFilmsComingSoon(
    quantity: number,
  ): Promise<FilmsComingSoonResponse> {
    const response = await firstValueFrom(
      this.httpService.get<FilmsComingSoonResponse>(
        MOVIE_GLU.FILMS_COMING_SOON(quantity),
      ),
    );

    return response.data;
  }

  private async getFilmDetails(filmId: number): Promise<FilmDetailsResponse> {
    const response = await firstValueFrom(
      this.httpService.get<FilmDetailsResponse>(MOVIE_GLU.FILMS_DETAIL(filmId)),
    );

    return response.data;
  }

  private async getCinemaDetails(
    cinemaId: number,
  ): Promise<CinemaDetailsResponse> {
    const response = await firstValueFrom(
      this.httpService.get<CinemaDetailsResponse>(
        MOVIE_GLU.CINEMA_DETAIL(cinemaId),
      ),
    );

    return response.data;
  }

  private async getCinemaShowTimes(
    date: string,
    cinemaId: number,
    filmId?: number,
    sort?: SortType,
  ): Promise<CinemaShowTimesResponse> {
    const response = await firstValueFrom(
      this.httpService.get<CinemaShowTimesResponse>(
        MOVIE_GLU.CINEMA_SHOWTIME(date, cinemaId, filmId, sort),
      ),
    );

    return response.data;
  }

  @Cron('0 0 */2 * * *')
  async syncDataCinemaNearBy(geolocation: string): Promise<void> {
    const quantity = 100;
    if (!geolocation) {
      return;
    }

    const data = await this.getCinemaNearBy(quantity, geolocation);
    this.logger.debug(`saving data : ${JSON.stringify(data.cinemas)}`);
    await this.dataBaseService.savingCinemas({ cinemas: data.cinemas });
  }
}
