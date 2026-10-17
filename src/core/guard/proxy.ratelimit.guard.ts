import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const ip = (req as { ip?: unknown }).ip;

    if (typeof ip === 'string' && ip) {
      return Promise.resolve(ip);
    }

    return super.getTracker(req);
  }
}
