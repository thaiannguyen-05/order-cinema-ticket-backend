jest.mock('../../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));

const { OutboxCronJobService } =
  require('../../../../background/outbox-cron-job/outbox-cron-job.service') as {
    OutboxCronJobService: new (...args: never[]) => {
      removeOutboxExp: () => Promise<void>;
    };
  };

const { REDIS_LOCK_KEY, REDIS_TTL } =
  require('../../../../background/redis/redis.value') as {
    REDIS_LOCK_KEY: { REMOVE_OUTBOX_EXP: string };
    REDIS_TTL: { LOCK_SERVICE: number };
  };

const { EXP_TIME_OUTBOX } =
  require('../../../../background/email/constant/time') as {
    EXP_TIME_OUTBOX: number;
  };

describe('OutboxCronJobService', () => {
  let redisLockService: { runExclusive: jest.Mock };
  let logger: { debug: jest.Mock };
  let outboxService: { deleteOutboxMessageExp: jest.Mock };
  let service: InstanceType<typeof OutboxCronJobService>;

  beforeEach(() => {
    redisLockService = {
      runExclusive: jest.fn(
        async (_key: string, _ttl: number, fn: () => Promise<void>) => fn(),
      ),
    };
    logger = { debug: jest.fn() };
    outboxService = { deleteOutboxMessageExp: jest.fn().mockResolvedValue({}) };

    service = new OutboxCronJobService(
      redisLockService as never,
      logger as never,
      outboxService as never,
    );
  });

  it('acquires lock with correct key and ttl', async () => {
    await service.removeOutboxExp();

    expect(redisLockService.runExclusive).toHaveBeenCalledWith(
      REDIS_LOCK_KEY.REMOVE_OUTBOX_EXP,
      REDIS_TTL.LOCK_SERVICE,
      expect.any(Function),
    );
  });

  it('deletes outbox entries older than configured expiration', async () => {
    const fixedNow = new Date('2026-04-01T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(fixedNow);

    await service.removeOutboxExp();

    expect(outboxService.deleteOutboxMessageExp).toHaveBeenCalledTimes(1);
    const expirationTime = outboxService.deleteOutboxMessageExp.mock
      .calls[0][0] as Date;
    expect(expirationTime).toBeInstanceOf(Date);
    expect(expirationTime.toISOString()).toBe(
      new Date(fixedNow.getTime() - EXP_TIME_OUTBOX * 1000).toISOString(),
    );

    jest.useRealTimers();
  });

  it('logs skip message when lock is already held', async () => {
    redisLockService.runExclusive.mockResolvedValue(null);

    await service.removeOutboxExp();

    expect(outboxService.deleteOutboxMessageExp).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'Skip request because lock is already held',
    );
  });

  it('propagates error when outbox deletion fails', async () => {
    outboxService.deleteOutboxMessageExp.mockRejectedValue(
      new Error('db down'),
    );

    await expect(service.removeOutboxExp()).rejects.toThrow('db down');
  });
});
