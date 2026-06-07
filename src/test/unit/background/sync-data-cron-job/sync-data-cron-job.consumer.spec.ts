jest.mock('../../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));
jest.mock('@andev2005/movie-glu-sdk', () => ({
  createMovieGluClient: jest.fn(),
}));

const { SyncDateCronJobConsumer } =
  require('../../../../background/sync-data-cron-job/sync-data-cron-job.consumer') as {
    SyncDateCronJobConsumer: new (...args: never[]) => {
      handleSyncEventCinemaDetail: (
        dto: unknown,
        context: unknown,
      ) => Promise<void>;
      handleSyncEventCinemaShowtime: (
        dto: unknown,
        context: unknown,
      ) => Promise<void>;
      handleSyncEventFilmShowtime: (
        dto: unknown,
        context: unknown,
      ) => Promise<void>;
    };
  };

describe('SyncDateCronJobConsumer', () => {
  it('delegates event handlers to callMovieGlu service', async () => {
    const callMovieGluService = {
      syncDataCinemaDetail: jest.fn().mockResolvedValue(undefined),
      syncDataCinemaShowtime: jest.fn().mockResolvedValue(undefined),
      syncDateFilmsOfCinema: jest.fn().mockResolvedValue(undefined),
    };

    const consumer = new SyncDateCronJobConsumer(callMovieGluService as never);
    const rmqContext = {
      getMessage: jest.fn().mockReturnValue({}),
      getChannelRef: jest.fn().mockReturnValue({
        ack: jest.fn(),
        nack: jest.fn(),
      }),
    };

    await consumer.handleSyncEventCinemaDetail(
      { cinemas: [] } as never,
      rmqContext as never,
    );
    await consumer.handleSyncEventCinemaShowtime(
      { cinemas: [] } as never,
      rmqContext as never,
    );
    await consumer.handleSyncEventFilmShowtime(
      { cinemas: [] } as never,
      rmqContext as never,
    );

    expect(callMovieGluService.syncDataCinemaDetail).toHaveBeenCalled();
    expect(callMovieGluService.syncDataCinemaShowtime).toHaveBeenCalled();
    expect(callMovieGluService.syncDateFilmsOfCinema).toHaveBeenCalled();
  });
});
