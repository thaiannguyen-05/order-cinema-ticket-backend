import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter, Gauge, Histogram } from 'prom-client';
import {
  METRIC_NAMES,
  type CronJobName,
  type ReplicaInstance,
  type ReplicaReadSource,
  type ReplicaTarget,
  type SearchTarget,
} from './metrics.constants';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric(METRIC_NAMES.HTTP_REQUESTS_TOTAL)
    public readonly httpRequestsTotal: Counter<string>,
    @InjectMetric(METRIC_NAMES.HTTP_REQUEST_DURATION)
    public readonly httpDuration: Histogram<string>,
    @InjectMetric(METRIC_NAMES.PAYMENT_ORDERS_TOTAL)
    public readonly paymentOrdersTotal: Counter<string>,
    @InjectMetric(METRIC_NAMES.PAYMENT_CHECKOUT_TOTAL)
    public readonly paymentCheckoutTotal: Counter<string>,
    @InjectMetric(METRIC_NAMES.SEPAY_WEBHOOK_TOTAL)
    public readonly sepayWebhookTotal: Counter<string>,
    @InjectMetric(METRIC_NAMES.SEPAY_SYNC_TOTAL)
    public readonly sepaySyncTotal: Counter<string>,
    @InjectMetric(METRIC_NAMES.SEARCH_TOTAL)
    public readonly searchTotal: Counter<string>,
    @InjectMetric(METRIC_NAMES.SEARCH_DURATION)
    public readonly searchDuration: Histogram<string>,
    @InjectMetric(METRIC_NAMES.CRON_RUNS_TOTAL)
    public readonly cronRunsTotal: Counter<string>,
    @InjectMetric(METRIC_NAMES.CRON_DURATION)
    public readonly cronDuration: Histogram<string>,
    @InjectMetric(METRIC_NAMES.CRON_LAST_SUCCESS)
    public readonly cronLastSuccess: Gauge<string>,
    @InjectMetric(METRIC_NAMES.CRON_EXPIRED_ORDERS)
    public readonly cronExpiredOrders: Counter<string>,
    @InjectMetric(METRIC_NAMES.CRON_OUTBOX_DELETED)
    public readonly cronOutboxDeleted: Counter<string>,
    @InjectMetric(METRIC_NAMES.CRON_SYNC_CINEMAS)
    public readonly cronSyncCinemas: Counter<string>,
    @InjectMetric(METRIC_NAMES.CRON_SYNC_FILMS)
    public readonly cronSyncFilms: Counter<string>,
    @InjectMetric(METRIC_NAMES.CRON_SYNC_SHOWTIMES)
    public readonly cronSyncShowtimes: Counter<string>,
    @InjectMetric(METRIC_NAMES.EMAIL_PUBLISHED_TOTAL)
    public readonly emailPublishedTotal: Counter<string>,
    @InjectMetric(METRIC_NAMES.EMAIL_CONSUMED_TOTAL)
    public readonly emailConsumedTotal: Counter<string>,
    @InjectMetric(METRIC_NAMES.EMAIL_DURATION)
    public readonly emailDuration: Histogram<string>,
    @InjectMetric(METRIC_NAMES.OUTBOX_PENDING)
    public readonly outboxPending: Gauge<string>,
    @InjectMetric(METRIC_NAMES.REPLICA_READ_TOTAL)
    public readonly replicaReadTotal: Counter<string>,
    @InjectMetric(METRIC_NAMES.REPLICA_LAG_SECONDS)
    public readonly replicaLag: Gauge<string>,
    @InjectMetric(METRIC_NAMES.REPLICA_UP)
    public readonly replicaUp: Gauge<string>,
  ) {}

  observeHttp(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = {
      method,
      route,
      status_code: String(statusCode),
    };
    this.httpRequestsTotal.inc(labels);
    this.httpDuration.observe(labels, durationSeconds);
  }

  incPaymentOrder(result: 'success' | 'conflict' | 'error'): void {
    this.paymentOrdersTotal.inc({ result });
  }

  incCheckout(result: 'success' | 'conflict' | 'error'): void {
    this.paymentCheckoutTotal.inc({ result });
  }

  incWebhook(
    result: 'paid' | 'failed' | 'cancelled' | 'idempotent' | 'error',
  ): void {
    this.sepayWebhookTotal.inc({ result });
  }

  incSync(result: 'ok' | 'expired' | 'error'): void {
    this.sepaySyncTotal.inc({ result });
  }

  observeSearch(
    target: SearchTarget,
    result: 'success' | 'error',
    durationSeconds: number,
  ): void {
    this.searchTotal.inc({ target, result });
    this.searchDuration.observe({ target, result }, durationSeconds);
  }

  cronStart(job: CronJobName): () => void {
    const start = Date.now();
    return () => {
      this.cronDuration.observe({ job }, (Date.now() - start) / 1000);
    };
  }

  cronSuccess(job: CronJobName): void {
    this.cronRunsTotal.inc({ job, status: 'success' });
    this.cronLastSuccess.set({ job }, Date.now() / 1000);
  }

  cronFailed(job: CronJobName): void {
    this.cronRunsTotal.inc({ job, status: 'failed' });
  }

  cronSkipped(job: CronJobName): void {
    this.cronRunsTotal.inc({ job, status: 'skipped' });
  }

  addExpiredOrders(count: number): void {
    if (count > 0) this.cronExpiredOrders.inc(count);
  }

  addOutboxDeleted(count: number): void {
    if (count > 0) this.cronOutboxDeleted.inc(count);
  }

  addSyncCounts(cinemas: number, films: number, showtimes: number): void {
    if (cinemas > 0) this.cronSyncCinemas.inc(cinemas);
    if (films > 0) this.cronSyncFilms.inc(films);
    if (showtimes > 0) this.cronSyncShowtimes.inc(showtimes);
  }

  incEmailPublished(event: 'verify' | 'reset', result: 'ok' | 'fail'): void {
    this.emailPublishedTotal.inc({ event, result });
  }

  incEmailConsumed(event: 'verify' | 'reset', result: 'ack' | 'nack'): void {
    this.emailConsumedTotal.inc({ event, result });
  }

  observeEmail(
    event: 'verify' | 'reset',
    result: 'ack' | 'nack',
    durationSeconds: number,
  ): void {
    this.emailDuration.observe({ event, result }, durationSeconds);
  }

  setOutboxPending(count: number): void {
    this.outboxPending.set(count);
  }

  incReplicaRead(
    source: ReplicaReadSource,
    target: ReplicaTarget,
    result: 'success' | 'error',
  ): void {
    this.replicaReadTotal.inc({ source, target, result });
  }

  setReplicaLag(seconds: number): void {
    this.replicaLag.set({ role: 'follower' }, Math.max(0, seconds));
  }

  setReplicaUp(instance: ReplicaInstance, up: 0 | 1): void {
    this.replicaUp.set({ instance }, up);
  }
}
