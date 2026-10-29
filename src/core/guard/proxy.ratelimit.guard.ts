import { ExecutionContext, Injectable } from '@nestjs/common';
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

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (this.isLoadTestBypass(context)) {
      return true;
    }

    return super.shouldSkip(context);
  }

  /**
   * Internal load-test bypass. Active only when LOADTEST_BYPASS_KEY is set
   * (leave it empty in prod). k6 sends the same value as `x-loadtest-key`.
   * Reads process.env directly to avoid touching the guard's DI constructor.
   */
  private isLoadTestBypass(context: ExecutionContext): boolean {
    const key = process.env.LOADTEST_BYPASS_KEY;
    if (!key) {
      return false;
    }

    const req = context
      .switchToHttp()
      .getRequest<{ headers?: Record<string, unknown> }>();
    const sent = req?.headers?.['x-loadtest-key'];

    return typeof sent === 'string' && sent.length > 0 && sent === key;
  }
}
