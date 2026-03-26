let acquireMock: jest.Mock;
let releaseMock: jest.Mock;

jest.mock('redlock', () => {
  return jest.fn().mockImplementation(() => ({
    acquire: acquireMock,
    release: releaseMock,
    on: jest.fn(),
  }));
});

const { RedisLockService } =
  require('../../../../background/redis/redis.lock.service') as {
    RedisLockService: new (...args: never[]) => {
      runExclusive: <T>(
        resource: string,
        ttlMs: number,
        fn: () => Promise<T>,
      ) => Promise<T | null>;
    };
  };

describe('RedisLockService', () => {
  beforeEach(() => {
    acquireMock = jest.fn();
    releaseMock = jest.fn();
  });

  it('returns null when acquire lock fails', async () => {
    acquireMock.mockRejectedValue(new Error('lock busy'));
    const service = new RedisLockService({} as never);

    await expect(
      service.runExclusive('resource', 1000, async () => 'ok'),
    ).resolves.toBeNull();
  });

  it('runs function and releases lock when acquired', async () => {
    const lock = { id: 'lock-1' };
    acquireMock.mockResolvedValue(lock);
    releaseMock.mockResolvedValue(undefined);

    const service = new RedisLockService({} as never);

    await expect(
      service.runExclusive('resource', 1000, async () => 'done'),
    ).resolves.toBe('done');
    expect(acquireMock).toHaveBeenCalledWith(['resource'], 1000);
    expect(releaseMock).toHaveBeenCalledWith(lock);
  });
});
