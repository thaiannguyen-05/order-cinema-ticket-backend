import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const request = req as { ips?: unknown; ip?: unknown };
    const ips = Array.isArray(request.ips) ? request.ips : [];

    if (ips.length > 0 && typeof ips[0] === 'string') {
      return Promise.resolve(ips[0]);
    }

    if (typeof request.ip === 'string') {
      return Promise.resolve(request.ip);
    }

    return super.getTracker(req);
  }
}
