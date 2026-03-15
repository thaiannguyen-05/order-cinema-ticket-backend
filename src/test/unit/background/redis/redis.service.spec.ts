import { RedisService } from '../../../../background/redis/redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    clear: jest.Mock;
  };

  beforeEach(() => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      clear: jest.fn(),
    };

    service = new RedisService(cacheManager as never);
  });

  it('gets value or null', async () => {
    cacheManager.get.mockResolvedValueOnce('abc').mockResolvedValueOnce(undefined);

    await expect(service.get('k1')).resolves.toBe('abc');
    await expect(service.get('k2')).resolves.toBeNull();
  });

  it('sets with and without ttl', async () => {
    await service.set('k1', 'v1', 10);
    await service.set('k2', 'v2');

    expect(cacheManager.set).toHaveBeenNthCalledWith(1, 'k1', 'v1', 10);
    expect(cacheManager.set).toHaveBeenNthCalledWith(2, 'k2', 'v2');
  });

  it('deletes and clears', async () => {
    await service.del('k1');
    await service.clear();

    expect(cacheManager.del).toHaveBeenCalledWith('k1');
    expect(cacheManager.clear).toHaveBeenCalled();
  });
});
