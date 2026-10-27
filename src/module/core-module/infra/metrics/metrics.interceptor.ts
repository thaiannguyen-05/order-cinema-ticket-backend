import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

function normalizeRoute(req: FastifyRequest): string {
  // Prefer matched route pattern to keep cardinality low (/v1/payment/sepay/sync/:orderId).
  const raw =
    (req as unknown as { routeOptions?: { url?: string } }).routeOptions?.url ??
    (req as unknown as { routerPath?: string }).routerPath ??
    req.url;
  // Strip query string, collapse uuids / numeric ids.
  const path = String(raw).split('?')[0];
  return path
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:id',
    )
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .slice(0, 200);
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const res = ctx.getResponse<FastifyReply>();

    // Skip Prometheus scrape itself to avoid self-observation loop.
    if (req.url.includes('/metrics')) {
      return next.handle();
    }

    const start = process.hrtime.bigint();
    const method = req.method;
    const route = normalizeRoute(req);

    return next.handle().pipe(
      tap({
        next: () => this.record(req, res, method, route, start),
        error: () => this.record(req, res, method, route, start),
      }),
    );
  }

  private record(
    _req: FastifyRequest,
    res: FastifyReply,
    method: string,
    route: string,
    start: bigint,
  ): void {
    try {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      const status = res?.statusCode ?? 500;
      this.metrics.observeHttp(method, route, status, duration);
    } catch {
      // metrics must never break the request path
    }
  }
}
