jest.mock('../../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));

jest.mock('@andev2005/movie-glu-sdk', () => ({
  createMovieGluClient: jest.fn(),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

const { createMovieGluClient } = require('@andev2005/movie-glu-sdk') as {
  createMovieGluClient: jest.Mock;
};
const axios = require('axios').default as { get: jest.Mock };

const { CallMovieGluService } = require('../../../../background/sync-data-cron-job/call-movie-glu.service') as {
  CallMovieGluService: new (...args: never[]) => {
    createMovieGluClientAtCall: (deviceDatetime: string, geolocation: string) => unknown;
    sanitizeIpAddress: (rawIp: string) => string;
    isPrivateIpAddress: (ip: string) => boolean;
    getServerPublicIp: () => Promise<string>;
    getGeolocationByUserIp: (ip: string) => Promise<string>;
    syncDataCinemaDetail: (dto: any) => Promise<void>;
    updateFilmsDetail: (dto: any) => Promise<void>;
    syncDateFilmsOfCinema: (dto: any) => Promise<void>;
  };
};

describe('CallMovieGluService', () => {
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const map: Record<string, string> = {
        MOVIE_GLU_APIKEY: 'api-key',
        GLU_CLIENT: 'client',
        GLU_AUTHORIZATION: 'auth',
        GLU_TERRITORY: 'VN',
        GLU_API_VER: 'v1',
      };
      return map[key];
    }),
  };

  let logger: { debug: jest.Mock; warn: jest.Mock };
  let cinemaService: { updateCinema: jest.Mock; getFilmsOfCinema: jest.Mock };
  let redisLockService: { runExclusive: jest.Mock };
  let eventCronJobService: { callSyncDataWithCinemaShowTime: jest.Mock };
  let filmService: { updateFilm: jest.Mock };
  let service: InstanceType<typeof CallMovieGluService>;

  beforeEach(() => {
    logger = { debug: jest.fn(), warn: jest.fn() };
    cinemaService = { updateCinema: jest.fn(), getFilmsOfCinema: jest.fn() };
    redisLockService = {
      runExclusive: jest.fn(async (_key: string, _ttl: number, fn: () => Promise<void>) => fn()),
    };
    eventCronJobService = { callSyncDataWithCinemaShowTime: jest.fn().mockResolvedValue(undefined) };
    filmService = { updateFilm: jest.fn().mockResolvedValue(undefined) };

    service = new CallMovieGluService(
      configService as never,
      logger as never,
      cinemaService as never,
      redisLockService as never,
      eventCronJobService as never,
      filmService as never,
    );
  });

  it('creates movie glu client with headers', () => {
    createMovieGluClient.mockReturnValue({ sdk: true });

    const result = service.createMovieGluClientAtCall('2026-01-01T00:00:00.000Z', '10;10');

    expect(result).toEqual({ sdk: true });
    expect(createMovieGluClient).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'api-key',
        headers: expect.objectContaining({ geolocation: '10;10' }),
      }),
    );
  });

  it('sanitizes and checks private ip address', () => {
    expect(service.sanitizeIpAddress('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(service.isPrivateIpAddress('127.0.0.1')).toBe(true);
    expect(service.isPrivateIpAddress('8.8.8.8')).toBe(false);
  });

  it('returns public ip when ipify succeeds, empty string on failure', async () => {
    axios.get.mockResolvedValueOnce({ data: { ip: '::ffff:8.8.8.8' } });
    axios.get.mockRejectedValueOnce(new Error('network'));

    await expect(service.getServerPublicIp()).resolves.toBe('8.8.8.8');
    await expect(service.getServerPublicIp()).resolves.toBe('');
    expect(logger.warn).toHaveBeenCalledWith('Failed to resolve server public IP');
  });

  it('returns fallback geolocation for private ip', async () => {
    await expect(service.getGeolocationByUserIp('127.0.0.1')).resolves.toBe('-22.0;14.0');
  });

  it('syncs cinema detail and emits next event', async () => {
    const dto = {
      cinemas: [
        { cinema_id: 1, cinema_name: 'A', address: 'Addr' },
        { cinema_id: 2, cinema_name: 'B', address: 'Addr2' },
      ],
      client: {},
      quantity: 100,
    };

    await service.syncDataCinemaDetail(dto as never);

    expect(cinemaService.updateCinema).toHaveBeenCalledTimes(2);
    expect(eventCronJobService.callSyncDataWithCinemaShowTime).toHaveBeenCalledWith(dto);
  });

  it('parses and updates film details', async () => {
    const dto = {
      film: [
        {
          film_id: 100,
          film_name: 'Film',
          review_stars: '4.5',
          directors: [{ name: 'D1' }],
        },
      ],
    };

    await service.updateFilmsDetail(dto as never);

    expect(filmService.updateFilm).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ review_stars: 4.5, director: [{ name: 'D1' }] }),
    );
  });

  it('syncs films of cinema and skips duplicated/unchanged films', async () => {
    cinemaService.getFilmsOfCinema.mockResolvedValue([
      {
        filmOfCinema: [
          {
            film: {
              film_id: 1,
              film_name: 'A',
              other_title: null,
              release_dates: null,
              age_rating: null,
              trailers: null,
              synopsis_long: 'new',
              images: null,
              version_type: null,
              duration_mins: null,
              review_stars: null,
              review_txt: null,
              distributor: null,
              genres: null,
              cast: null,
              directors: null,
              producers: null,
              writers: null,
            },
          },
          {
            film: {
              film_id: 1,
              film_name: 'A',
              other_title: null,
              release_dates: null,
              age_rating: null,
              trailers: null,
              synopsis_long: 'new',
              images: null,
              version_type: null,
              duration_mins: null,
              review_stars: null,
              review_txt: null,
              distributor: null,
              genres: null,
              cast: null,
              directors: null,
              producers: null,
              writers: null,
            },
          },
        ],
      },
    ]);

    await service.syncDateFilmsOfCinema({ cinemas: [{ cinema_id: 1 }] } as never);

    expect(cinemaService.getFilmsOfCinema).toHaveBeenCalledWith(1);
    expect(filmService.updateFilm).not.toHaveBeenCalled();
  });
});
