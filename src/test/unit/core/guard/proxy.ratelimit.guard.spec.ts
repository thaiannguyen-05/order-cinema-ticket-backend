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

  it('skips throttle when x-loadtest-key matches env', async () => {
    process.env.LOADTEST_BYPASS_KEY = 'test-bypass-key';
    try {
      const guard = Object.create(
        ThrottlerBehindProxyGuard.prototype,
      ) as ThrottlerBehindProxyGuard;
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-loadtest-key': 'test-bypass-key' },
          }),
        }),
      } as never;

      await expect(guard['shouldSkip'](context)).resolves.toBe(true);
    } finally {
      delete process.env.LOADTEST_BYPASS_KEY;
    }
  });

  it('does not bypass when env key is missing or header mismatches', async () => {
    const guard = Object.create(
      ThrottlerBehindProxyGuard.prototype,
    ) as ThrottlerBehindProxyGuard;
    const makeContext = (headers: Record<string, string>) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ headers }),
        }),
      }) as never;

    delete process.env.LOADTEST_BYPASS_KEY;
    expect(
      guard['isLoadTestBypass'](makeContext({ 'x-loadtest-key': 'x' })),
    ).toBe(false);

    process.env.LOADTEST_BYPASS_KEY = 'real-key';
    try {
      expect(guard['isLoadTestBypass'](makeContext({}))).toBe(false);
      expect(
        guard['isLoadTestBypass'](
          makeContext({ 'x-loadtest-key': 'wrong-key' }),
        ),
      ).toBe(false);
      expect(
        guard['isLoadTestBypass'](
          makeContext({ 'x-loadtest-key': 'real-key' }),
        ),
      ).toBe(true);
    } finally {
      delete process.env.LOADTEST_BYPASS_KEY;
    }
  });
});
