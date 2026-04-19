import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  public async getTracker<T>(req: Record<string, T>): Promise<string> {
    return (await req.ips.length) ? req.ips[0] : req.ip;
  }
}
