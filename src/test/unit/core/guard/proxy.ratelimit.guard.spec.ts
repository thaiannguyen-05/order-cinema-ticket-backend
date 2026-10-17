import { ThrottlerBehindProxyGuard } from '../../../../core/guard/proxy.ratelimit.guard';

describe('ThrottlerBehindProxyGuard', () => {
  it('uses req.ip from Fastify (trustProxy)', async () => {
    const guard = Object.create(
      ThrottlerBehindProxyGuard.prototype,
    ) as ThrottlerBehindProxyGuard;

    await expect(guard['getTracker']({ ip: '1.1.1.1' })).resolves.toBe(
      '1.1.1.1',
    );
  });

  it('uses req.ip when present', async () => {
    const guard = Object.create(
      ThrottlerBehindProxyGuard.prototype,
    ) as ThrottlerBehindProxyGuard;

    await expect(guard['getTracker']({ ip: '3.3.3.3' })).resolves.toBe(
      '3.3.3.3',
    );
  });
});
