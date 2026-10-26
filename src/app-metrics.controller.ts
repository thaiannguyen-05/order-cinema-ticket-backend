import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Public } from './core/decorator/ispublic.decorator';

// Public scrape endpoint: GET /v1/metrics (no JWT, no throttle).
// The stock PrometheusController has neither @Public() nor a version, so with
// global AuthenticationGuard + URI versioning it would 401 or miss /v1 prefix.
// Subclassing lets us pin version '1' and opt out of auth + throttle.
@Public()
@SkipThrottle()
@Controller({ path: 'metrics', version: '1' })
export class PublicMetricsController extends PrometheusController {
  @Get()
  @Public()
  @SkipThrottle()
  index(@Res({ passthrough: true }) response: unknown): Promise<string> {
    return super.index(response as never);
  }
}
