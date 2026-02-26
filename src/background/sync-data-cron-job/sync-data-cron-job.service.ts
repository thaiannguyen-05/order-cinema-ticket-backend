import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { MyLogger } from '../../logger/logger.service';
import { PrismaDatabaseService } from './prisma.database.service';
import {
  createMovieGluClient,
  type MovieGluSdk,
} from '@andev2005/movie-glu-sdk';
@Injectable()
export class SyncDataCronJobService {
  private readonly client: MovieGluSdk;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: MyLogger,
    private readonly dataBaseService: PrismaDatabaseService,
  ) {
    this.client = createMovieGluClient({
      apiKey: this.configService.getOrThrow<string>('MOVIE_GLU_APIKEY'),
    });
  }

  @Cron('0 0 */2 * * *')
  async syncDataCinemaNearBy(): Promise<void> {
    const quantity = 100;
    const { cinemas } = await this.client.cinemas.nearby({ limit: quantity });

    for (const cinema of cinemas) {
      await this.dataBaseService.upsertCinema(cinema.cinema_id, cinema);
    }
  }
}
