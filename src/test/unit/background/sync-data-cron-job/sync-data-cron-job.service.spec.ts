jest.mock('../../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));

const { SyncDataCronJobService } =
  require('../../../../background/sync-data-cron-job/sync-data-cron-job.service') as {
    SyncDataCronJobService: new (...args: never[]) => {
      syncDataCinemaNearBy: () => Promise<void>;
      syncNowShowingFilms: () => Promise<void>;
      syncNowFilmsComingSoon: () => Promise<void>;
      syncFilmsDetails: () => Promise<void>;
    };
  };

describe('SyncDataCronJobService', () => {
  let logger: { debug: jest.Mock };
  let cinemaService: { upsertCinema: jest.Mock };
  let redisLockService: { runExclusive: jest.Mock };
  let eventCronJobService: {
    callSyncDataWithCinemaDetail: jest.Mock;
    callSyncDataWithFilmShowTime: jest.Mock;
  };
  let callMovieGluService: {
    getServerPublicIp: jest.Mock;
    getGeolocationByUserIp: jest.Mock;
    createMovieGluClientAtCall: jest.Mock;
    updateFilmsDetail: jest.Mock;
  };
  let filmService: { getAllFilms: jest.Mock };
  let service: InstanceType<typeof SyncDataCronJobService>;

  beforeEach(() => {
    logger = { debug: jest.fn() };
    cinemaService = { upsertCinema: jest.fn().mockResolvedValue(undefined) };
    redisLockService = {
      runExclusive: jest.fn(
        async (_k: string, _ttl: number, fn: () => Promise<void>) => fn(),
      ),
    };
    eventCronJobService = {
      callSyncDataWithCinemaDetail: jest.fn().mockResolvedValue(undefined),
      callSyncDataWithFilmShowTime: jest.fn().mockResolvedValue(undefined),
    };
    callMovieGluService = {
      getServerPublicIp: jest.fn().mockResolvedValue('8.8.8.8'),
      getGeolocationByUserIp: jest.fn().mockResolvedValue('10;10'),
      createMovieGluClientAtCall: jest.fn(),
      updateFilmsDetail: jest.fn().mockResolvedValue(undefined),
    };
    filmService = {
      getAllFilms: jest.fn().mockResolvedValue([{ film_id: 1 }]),
    };

    const client = {
      cinemas: {
        nearby: jest.fn().mockResolvedValue({
          cinemas: [{ cinema_id: 1, cinema_name: 'A', address: 'Addr' }],
        }),
      },
      films: {
        nowShowing: jest.fn().mockResolvedValue({ films: [{ film_id: 1 }] }),
        comingSoon: jest.fn().mockResolvedValue({ films: [{ film_id: 2 }] }),
        details: jest.fn().mockResolvedValue({ film_id: 1, film_name: 'A' }),
      },
    };

    callMovieGluService.createMovieGluClientAtCall.mockReturnValue(client);

    service = new SyncDataCronJobService(
      logger as never,
      cinemaService as never,
      redisLockService as never,
      eventCronJobService as never,
      callMovieGluService as never,
      filmService as never,
    );
  });

  it('syncs nearby cinema and emits detail/showtime jobs', async () => {
    await service.syncDataCinemaNearBy();

    expect(cinemaService.upsertCinema).toHaveBeenCalledTimes(1);
    expect(eventCronJobService.callSyncDataWithCinemaDetail).toHaveBeenCalled();
    expect(eventCronJobService.callSyncDataWithFilmShowTime).toHaveBeenCalled();
  });

  it('syncs now showing and coming soon films', async () => {
    await service.syncNowShowingFilms();
    await service.syncNowFilmsComingSoon();

    expect(logger.debug).toHaveBeenCalled();
  });

  it('syncs film details from existing films', async () => {
    await service.syncFilmsDetails();

    expect(filmService.getAllFilms).toHaveBeenCalled();
    expect(callMovieGluService.updateFilmsDetail).toHaveBeenCalledWith({
      film: [{ film_id: 1, film_name: 'A' }],
    });
  });

  it('logs skip when lock cannot be acquired', async () => {
    redisLockService.runExclusive.mockResolvedValue(null);

    await service.syncNowShowingFilms();

    expect(logger.debug).toHaveBeenCalledWith(
      'Skip because lock is already held',
    );
  });
});
