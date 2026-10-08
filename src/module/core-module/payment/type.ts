import type { Order, Prisma } from '@prisma/client';

// Payment is a view over Order (no separate Payment table).
export type PaymentOrder = Order;

export type PaymentStatus = Order['status'];

export type PaymentCreateData = Prisma.OrderUncheckedCreateInput;

export type PaymentUpdateData = Pick<PaymentOrder, 'status'>;

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
  signature: string;
};

export type SepayCheckoutResult = {
  orderId: string;
  checkoutUrl: string;
};

// Field order for the HMAC-SHA256 (base64) signature. Assumption: SePay signs
// the pipe-joined field values in form order. Confirm against SePay merchant
// docs if checkout init rejects the signature.
export const SEPAY_SIGN_FIELDS = [
  'merchant',
  'currency',
  'order_amount',
  'operation',
  'order_description',
  'order_invoice_number',
  'customer_id',
  'success_url',
  'error_url',
  'cancel_url',
] as const;

export type SepaySignField = (typeof SEPAY_SIGN_FIELDS)[number];
