import { Cinema, MovieGluSdk } from '@andev2005/movie-glu-sdk';

export type SyncCinemaDetailDto = {
  client: MovieGluSdk;
  quantity: number;
  cinemas: Cinema[];
};
