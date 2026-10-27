import { Global, Module } from '@nestjs/common';
import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { HTTP_HISTOGRAM_BUCKETS, METRIC_NAMES } from './metrics.constants';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  providers: [
    makeCounterProvider({
      name: METRIC_NAMES.HTTP_REQUESTS_TOTAL,
      help: 'Total HTTP requests (RED: rate).',
      labelNames: ['method', 'route', 'status_code'],
    }),
    makeHistogramProvider({
      name: METRIC_NAMES.HTTP_REQUEST_DURATION,
      help: 'HTTP request duration in seconds (RED: duration).',
      labelNames: ['method', 'route', 'status_code'],
      buckets: HTTP_HISTOGRAM_BUCKETS,
    }),
    makeCounterProvider({
      name: METRIC_NAMES.PAYMENT_ORDERS_TOTAL,
      help: 'Payment createOrder attempts by result.',
      labelNames: ['result'],
    }),
    makeCounterProvider({
      name: METRIC_NAMES.PAYMENT_CHECKOUT_TOTAL,
      help: 'SePay checkout init attempts by result.',
      labelNames: ['result'],
    }),
    makeCounterProvider({
      name: METRIC_NAMES.SEPAY_WEBHOOK_TOTAL,
      help: 'SePay IPN webhook outcomes (only path to PAID).',
      labelNames: ['result'],
    }),
    makeCounterProvider({
      name: METRIC_NAMES.SEPAY_SYNC_TOTAL,
      help: 'SePay syncOrder polls by result.',
      labelNames: ['result'],
    }),
    makeCounterProvider({
      name: METRIC_NAMES.SEARCH_TOTAL,
      help: 'Search requests by target (film|cinema|seat).',
      labelNames: ['target', 'result'],
    }),
    makeHistogramProvider({
      name: METRIC_NAMES.SEARCH_DURATION,
      help: 'Search duration in seconds by target.',
      labelNames: ['target', 'result'],
      buckets: HTTP_HISTOGRAM_BUCKETS,
    }),
    makeCounterProvider({
      name: METRIC_NAMES.CRON_RUNS_TOTAL,
      help: 'Cron job runs by job and status.',
      labelNames: ['job', 'status'],
    }),
    makeHistogramProvider({
      name: METRIC_NAMES.CRON_DURATION,
      help: 'Cron job duration in seconds.',
      labelNames: ['job'],
      buckets: [1, 5, 10, 30, 60, 120, 300],
    }),
    makeGaugeProvider({
      name: METRIC_NAMES.CRON_LAST_SUCCESS,
      help: 'Unix timestamp of last successful cron run.',
      labelNames: ['job'],
    }),
    makeCounterProvider({
      name: METRIC_NAMES.CRON_EXPIRED_ORDERS,
      help: 'Orders expired by expire_pending_orders cron.',
    }),
    makeCounterProvider({
      name: METRIC_NAMES.CRON_OUTBOX_DELETED,
      help: 'Outbox rows deleted by remove_outbox_exp cron.',
    }),
    makeCounterProvider({
      name: METRIC_NAMES.CRON_SYNC_CINEMAS,
      help: 'Cinemas upserted by sync_data_glu cron.',
    }),
    makeCounterProvider({
      name: METRIC_NAMES.CRON_SYNC_FILMS,
      help: 'Films enriched by sync_data_glu cron.',
    }),
    makeCounterProvider({
      name: METRIC_NAMES.CRON_SYNC_SHOWTIMES,
      help: 'Showtimes synced by sync_data_glu cron.',
    }),
    makeCounterProvider({
      name: METRIC_NAMES.EMAIL_PUBLISHED_TOTAL,
      help: 'Email events published to RabbitMQ.',
      labelNames: ['event', 'result'],
    }),
    makeCounterProvider({
      name: METRIC_NAMES.EMAIL_CONSUMED_TOTAL,
      help: 'Email events consumed from RabbitMQ (ack|nack).',
      labelNames: ['event', 'result'],
    }),
    makeHistogramProvider({
      name: METRIC_NAMES.EMAIL_DURATION,
      help: 'Email consumer handling duration in seconds.',
      labelNames: ['event', 'result'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    }),
    makeGaugeProvider({
      name: METRIC_NAMES.OUTBOX_PENDING,
      help: 'Pending outbox messages (email retry backlog). Updated by outbox cron.',
    }),
    MetricsService,
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
