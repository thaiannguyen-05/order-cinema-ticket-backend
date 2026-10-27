export const METRIC_NAMES = {
  HTTP_REQUESTS_TOTAL: 'app_http_requests_total',
  HTTP_REQUEST_DURATION: 'app_http_request_duration_seconds',
  PAYMENT_ORDERS_TOTAL: 'app_payment_orders_total',
  PAYMENT_CHECKOUT_TOTAL: 'app_payment_checkout_total',
  SEPAY_WEBHOOK_TOTAL: 'app_sepay_webhook_total',
  SEPAY_SYNC_TOTAL: 'app_sepay_sync_total',
  SEARCH_DURATION: 'app_search_duration_seconds',
  SEARCH_TOTAL: 'app_search_requests_total',
  CRON_RUNS_TOTAL: 'app_cron_job_runs_total',
  CRON_DURATION: 'app_cron_job_duration_seconds',
  CRON_LAST_SUCCESS: 'app_cron_job_last_success_timestamp',
  CRON_EXPIRED_ORDERS: 'app_cron_expired_orders_total',
  CRON_OUTBOX_DELETED: 'app_cron_outbox_deleted_total',
  CRON_SYNC_CINEMAS: 'app_cron_sync_cinemas_total',
  CRON_SYNC_FILMS: 'app_cron_sync_films_total',
  CRON_SYNC_SHOWTIMES: 'app_cron_sync_showtimes_total',
  EMAIL_PUBLISHED_TOTAL: 'app_email_published_total',
  EMAIL_CONSUMED_TOTAL: 'app_email_consumed_total',
  EMAIL_DURATION: 'app_email_duration_seconds',
  OUTBOX_PENDING: 'app_outbox_pending',
} as const;

export const HTTP_HISTOGRAM_BUCKETS = [0.05, 0.1, 0.3, 0.5, 1, 2, 5];

export type CronJobName =
  | 'expire_pending_orders'
  | 'remove_outbox_exp'
  | 'sync_data_glu';

export type SearchTarget = 'film' | 'cinema' | 'seat';
