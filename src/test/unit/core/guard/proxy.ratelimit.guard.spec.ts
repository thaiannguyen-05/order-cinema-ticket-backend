import { ThrottlerBehindProxyGuard } from '../../../../core/guard/proxy.ratelimit.guard';

describe('ThrottlerBehindProxyGuard', () => {
  it('uses first value from ips when available', async () => {
    const guard = Object.create(ThrottlerBehindProxyGuard.prototype) as ThrottlerBehindProxyGuard;

    await expect(guard['getTracker']({ ips: ['1.1.1.1', '2.2.2.2'] })).resolves.toBe('1.1.1.1');
  });

  it('uses req.ip when ips is empty', async () => {
    const guard = Object.create(ThrottlerBehindProxyGuard.prototype) as ThrottlerBehindProxyGuard;

    await expect(guard['getTracker']({ ips: [], ip: '3.3.3.3' })).resolves.toBe('3.3.3.3');
  });
});
