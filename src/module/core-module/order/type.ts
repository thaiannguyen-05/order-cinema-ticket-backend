import { OrderStatus, type Order, type Prisma } from '@prisma/client';

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
