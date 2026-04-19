jest.mock('ioredis', () => {
  return jest
    .fn()
    .mockImplementation((url: string) => ({ url, on: jest.fn() }));
});

import { RedisLockProvider } from '../../../../background/redis/redis-lock.provider';

describe('RedisLockProvider', () => {
  it('creates redis client from config redis host and port', () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('6379'),
      get: jest.fn().mockReturnValue('127.0.0.1'),
    };

    const client = RedisLockProvider.useFactory(config as never) as {
      url: string;
      on: jest.Mock;
    };

    expect(config.get).toHaveBeenCalledWith('REDIS_HOST', 'localhost');
    expect(config.getOrThrow).toHaveBeenCalledWith('REDIS_PORT');
    expect(client.url).toBe('redis://127.0.0.1:6379');
    expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
