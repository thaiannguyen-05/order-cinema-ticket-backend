import {
  createMovieGluClient,
  type MovieGluSdk,
} from '@andev2005/movie-glu-sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { MyLogger } from '../../logger/logger.service';
import { PrismaDatabaseService } from './prisma.database.service';
@Injectable()
export class SyncDataCronJobService {
  private readonly client: MovieGluSdk;

  constructor(
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

    this.logger.debug(`Data cinema nearby ${JSON.stringify(cinemas)}`);

    for (const cinema of cinemas) {
      await this.dataBaseService.upsertCinema(cinema.cinema_id, cinema);
    }
  }

  @Cron('0 0 * * * *')
  async syncDataFilmNowShowing() {
    const quantity = 100;
    this.logger.debug(`Call sync data film now showing`);
    return await this.client.films.nowShowing({ limit: quantity });
  }

  @Cron('0 0 * * * *')
  async syncDataFilmComingSoon() {
    const quantity = 100;
    this.logger.debug(`Call sync data film coming soon`);
    return await this.client.films.comingSoon({ limit: quantity });
  }
}
