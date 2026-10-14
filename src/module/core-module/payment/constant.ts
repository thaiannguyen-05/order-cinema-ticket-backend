export const PAYMENT_LOCK_KEY = {
  CREATE_BY_TICKET: (ticketId: string) => `lock:payment:create:${ticketId}`,
  CHECKOUT_BY_INVOICE: (invoice: string) => `lock:sepay:checkout:${invoice}`,
  WEBHOOK_BY_INVOICE: (invoice: string) => `lock:sepay:webhook:${invoice}`,
  UPDATE_BY_ORDER: (orderId: string) => `lock:payment:update:${orderId}`,
} as const;

export const PAYMENT_LOCK_TTL_MS = {
  CREATE: 5000,
  CHECKOUT: 10000,
  WEBHOOK: 10000,
  UPDATE: 5000,
} as const;

export const SEPAY = {
  BASE_URL: 'https://pay.sepay.vn',
  CHECKOUT_PATH: '/v1/checkout/init',
  OPERATION: 'PURCHASE',
  TIMEOUT_MS: 5000,
  WEBHOOK_SECRET_HEADER: 'x-secret-key',
} as const;

export const SEPAY_NOTIFICATION_TYPE = {
  ORDER_PAID: 'ORDER_PAID',
  TRANSACTION_VOID: 'TRANSACTION_VOID',
} as const;

// Sepay IPN success markers (example payload: order_status=CAPTURED, transaction_status=APPROVED).
export const SEPAY_SUCCESS_ORDER_STATUSES = [
  'CAPTURED',
  'COMPLETED',
  'PAID',
  'SUCCESS',
] as const;

export const SEPAY_SUCCESS_TRANSACTION_STATUSES = [
  'APPROVED',
  'SUCCESS',
  'PAID',
  'COMPLETED',
  'CAPTURED',
] as const;
