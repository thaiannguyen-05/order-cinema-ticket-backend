import { ExecutionContext, Injectable } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';

/**
 * Global cache with safety bypasses.
 *
 * The stock CacheInterceptor caches every GET by URL with no expiry
 * (CacheModule has no ttl configured). That is wrong for:
 * - /v1/metrics — Prometheus must see fresh exposition, not the first scrape.
 * - /health      — liveness checks must reflect current state.
 * - /v1/payment/* — order state (PENDING -> PAID via webhook) must never
 *   be served stale; money path reads bypass the cache entirely.
 */
@Injectable()
export class AppCacheInterceptor extends CacheInterceptor {
  private static readonly BYPASSED_PREFIXES = [
    '/metrics',
    '/health',
    '/v1/payment',
    '/payment',
  ];

  trackBy(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest<{ url?: string }>();
    const url = req?.url ?? '';
    if (AppCacheInterceptor.BYPASSED_PREFIXES.some((p) => url.includes(p))) {
      return undefined;
    }
    return super.trackBy(context);
  }
}
