import { EventCronJobWorkerService } from '../../../../background/sync-data-cron-job/event.cron-job.worker';
import { EVENT_NAME } from '../../../../background/email/constant/event.type';

describe('EventCronJobWorkerService', () => {
  it('emits all sync events', async () => {
    const clientProxy = { emit: jest.fn() };
    const service = new EventCronJobWorkerService(clientProxy as never);

    const payload = { cinemas: [], client: {}, quantity: 100 };

    await service.callSyncDataWithCinemaDetail(payload as never);
    await service.callSyncDataWithCinemaShowTime(payload as never);
    await service.callSyncDataWithFilmShowTime(payload as never);

    expect(clientProxy.emit).toHaveBeenNthCalledWith(
      1,
      EVENT_NAME.DETAIL_CINEMA,
      payload,
    );
    expect(clientProxy.emit).toHaveBeenNthCalledWith(
      2,
      EVENT_NAME.CINEMA_SHOWTIME,
      payload,
    );
    expect(clientProxy.emit).toHaveBeenNthCalledWith(
      3,
      EVENT_NAME.FILM_SHOWTIME,
      payload,
    );
  });
});
