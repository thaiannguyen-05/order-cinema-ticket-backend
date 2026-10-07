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
