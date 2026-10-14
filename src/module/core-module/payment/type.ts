import { OrderStatus, type Order, type Prisma } from '@prisma/client';

// Payment is a view over Order (no separate Payment table).
export type PaymentOrder = Order;

export type PaymentStatus = Order['status'];

export type PaymentCreateData = Prisma.OrderUncheckedCreateInput;

export type PaymentUpdateData = Pick<PaymentOrder, 'status'>;

export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> =
  {
    [OrderStatus.PENDING]: [
      OrderStatus.PAID,
      OrderStatus.FAILED,
      OrderStatus.EXPIRED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.PAID]: [],
    [OrderStatus.FAILED]: [],
    [OrderStatus.EXPIRED]: [],
    [OrderStatus.CANCELLED]: [],
  };

export type SepayCheckoutForm = {
  merchant: string;
  currency: string;
  order_amount: string;
  operation: string;
  order_description: string;
  order_invoice_number: string;
  customer_id: string;
  success_url: string;
  error_url: string;
  cancel_url: string;
  payment_method?: string;
  signature: string;
};

export type SepayCheckoutResult = {
  orderId: string;
  checkoutUrl: string;
};

export type SepayWebhookResult = {
  orderId: string;
  status: PaymentStatus;
  idempotent: boolean;
};

// Field order for HMAC-SHA256 (base64) signature per Sepay merchant docs:
// sign `field=value` pairs joined by `,` in this exact order, skipping absent
// optional fields (e.g. payment_method). Do NOT reorder.
// Ref: https://developer.sepay.vn/en/cong-thanh-toan/API/don-hang/form-thanh-toan
export const SEPAY_SIGN_FIELDS = [
  'order_amount',
  'merchant',
  'currency',
  'operation',
  'order_description',
  'order_invoice_number',
  'customer_id',
  'payment_method',
  'success_url',
  'error_url',
  'cancel_url',
] as const;

export type SepaySignField = (typeof SEPAY_SIGN_FIELDS)[number];
