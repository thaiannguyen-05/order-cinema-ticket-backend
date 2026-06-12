import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketService } from '../../theater-module/ticket/ticket.service';
import { CreateOrderDto } from './dto/create.order.dto';
import { UpdateOrderDto } from './dto/update.order.dto';
import { CreatePaymentDto } from './dto/create.payment.dto';
import { UpdatePaymentDto } from './dto/update.payment.dto';
import { OrderStatus } from '@prisma/client';
import { toIntAmount } from './amount.converter';
import { OrderRepository } from './repository/order.repository';

@Injectable()
export class PaymentService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly ticketService: TicketService,
  ) {}

  async createOrder(dto: CreateOrderDto, userId: string) {
    const ticket = await this.ticketService.getTicketById(dto.ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const existingOrder = await this.orderRepository.findOrderByTicketId(
      dto.ticketId,
    );

    if (existingOrder) {
      throw new ConflictException('An order already exists for this ticket');
    }

    return this.orderRepository.createOrder({
      ticketId: dto.ticketId,
      userId: userId,
      status: OrderStatus.AUTHENTICATION_NOT_NEEDED,
    });
  }

  async updateOrderStatus(orderId: string, dto: UpdateOrderDto) {
    const existingOrder = await this.orderRepository.findOrderById(orderId);

    if (!existingOrder) {
      throw new NotFoundException('Order not found');
    }

    return this.orderRepository.updateOrderStatus({
      orderId,
      status: dto.status,
    });
  }

  async createPayment(dto: CreatePaymentDto, userId: string) {
    const order = await this.orderRepository.findOrderByIdAndUserId(
      dto.orderId,
      userId,
    );

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const existingPayment = await this.orderRepository.findPaymentByOrderId(
      dto.orderId,
    );

    if (existingPayment) {
      throw new ConflictException('A payment already exists for this order');
    }

    return this.orderRepository.createPayment({
      orderId: dto.orderId,
      amount: toIntAmount(dto.amount),
      currency: dto.currency,
    });
  }

  async updatePayment(paymentId: number, dto: UpdatePaymentDto) {
    const existingPayment =
      await this.orderRepository.findPaymentById(paymentId);

    if (!existingPayment) {
      throw new NotFoundException('Payment not found');
    }

    if (dto.orderId) {
      const existingOrderForPayment =
        await this.orderRepository.findPaymentByOrderIdExcluding(
          dto.orderId,
          paymentId,
        );

      if (existingOrderForPayment) {
        throw new ConflictException('A payment already exists for this order');
      }
    }

    return this.orderRepository.updatePayment(paymentId, {
      ...(dto.amount !== undefined && { amount: toIntAmount(dto.amount) }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.orderStatus !== undefined && { orderStatus: dto.orderStatus }),
    });
  }
}
