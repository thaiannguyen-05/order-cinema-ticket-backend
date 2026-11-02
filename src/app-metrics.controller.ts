import { Controller, Get, Res } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Public } from './core/decorator/ispublic.decorator';

// Public scrape endpoint: GET /v1/metrics (no JWT). Throttle applies (default
// bucket) so unauthenticated scraping cannot be used for L7 flood. For prod,
// restrict further at ingress (private port / IP allowlist / scrape token).
@Public()
@Controller({ path: 'metrics', version: '1' })
export class PublicMetricsController extends PrometheusController {
  @Get()
  @Public()
  index(@Res({ passthrough: true }) response: unknown): Promise<string> {
    return super.index(response as never);
  }
}
