export const PAYMENT_LOCK_KEY = {
  CREATE_BY_TICKET: (ticketId: string) => `lock:payment:create:${ticketId}`,
  CHECKOUT_BY_INVOICE: (invoice: string) => `lock:sepay:checkout:${invoice}`,
} as const;

export const PAYMENT_LOCK_TTL_MS = {
  CREATE: 5000,
  CHECKOUT: 10000,
} as const;

export const SEPAY = {
  BASE_URL: 'https://pay.sepay.vn',
  CHECKOUT_PATH: '/v1/checkout/init',
  OPERATION: 'PURCHASE',
  TIMEOUT_MS: 5000,
} as const;
