jest.mock('ioredis', () => {
  return jest.fn().mockImplementation((url: string) => ({ url }));
});

import { RedisLockProvider } from '../../../../background/redis/redis-lock.provider';

describe('RedisLockProvider', () => {
  it('creates redis client from config redis port', () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('6379'),
    };

    const client = RedisLockProvider.useFactory(config as never);

    expect(config.getOrThrow).toHaveBeenCalledWith('REDIS_PORT');
    expect(client).toEqual({ url: 'redis://localhost:6379' });
  });
});
