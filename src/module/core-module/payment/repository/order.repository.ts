import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../background/prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

export interface CreateOrderInput {
  ticketId: string;
  userId: string;
  status: OrderStatus;
}

export interface UpdateOrderStatusInput {
  orderId: string;
  status: OrderStatus;
}

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  currency: string;
}

export interface UpdatePaymentInput {
  orderId: string;
  amount?: number;
  orderStatus?: OrderStatus;
}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrderByIdAndUserId(id: string, userId: string) {
    return this.prisma.order.findUnique({
      where: { id_userId: { id, userId } },
    });
  }

  async findOrderById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
    });
  }

  async findOrderByTicketId(ticketId: string) {
    return this.prisma.order.findUnique({
      where: { ticketId },
    });
  }

  async createOrder(input: CreateOrderInput) {
    return this.prisma.order.create({
      data: input,
    });
  }

  async updateOrderStatus(input: UpdateOrderStatusInput) {
    return this.prisma.order.update({
      where: { id: input.orderId },
      data: { status: input.status },
    });
  }

  async findPaymentByOrderId(orderId: string) {
    return this.prisma.payment.findUnique({
      where: { orderId },
    });
  }

  async findPaymentById(id: number) {
    return this.prisma.payment.findUnique({
      where: { id },
    });
  }

  async findPaymentByOrderIdExcluding(orderId: string, paymentId: number) {
    return this.prisma.payment.findFirst({
      where: {
        orderId,
        id: { not: paymentId },
      },
    });
  }

  async createPayment(input: CreatePaymentInput) {
    return this.prisma.payment.create({
      data: input,
    });
  }

  async updatePayment(paymentId: number, data: Partial<UpdatePaymentInput>) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data,
    });
  }

  async updateOrderAndUpsertPayment(
    orderId: string,
    orderStatus: OrderStatus,
    payment: CreatePaymentInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: orderStatus },
      });

      return tx.payment.upsert({
        where: { orderId },
        create: {
          amount: payment.amount,
          currency: payment.currency,
          orderId,
        },
        update: {
          amount: payment.amount,
          orderStatus,
        },
      });
    });
  }
}
