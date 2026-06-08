import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../background/prisma/prisma.service';
import { TicketService } from '../../theater-module/ticket/ticket.service';
import { CreateOrderDto } from './dto/create.order.dto';
import { UpdateOrderDto } from './dto/update.order.dto';
import { CreatePaymentDto } from './dto/create.payment.dto';
import { UpdatePaymentDto } from './dto/update.payment.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly ticketService: TicketService,
  ) {}

  async createOrder(dto: CreateOrderDto, userId: string) {
    const ticket = await this.ticketService.getTicketById(dto.ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId !== userId) {
      throw new ForbiddenException('Ticket does not belong to this user');
    }

    const existingOrder = await this.prismaService.order.findUnique({
      where: { ticketId: dto.ticketId },
    });

    if (existingOrder) {
      throw new ConflictException('An order already exists for this ticket');
    }

    return await this.prismaService.order.create({
      data: {
        ticketId: dto.ticketId,
        userId: userId,
        status: OrderStatus.AUTHENTICATION_NOT_NEEDED,
      },
    });
  }

  async updateOrderStatus(orderId: string, dto: UpdateOrderDto) {
    const existingOrder = await this.prismaService.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      throw new NotFoundException('Order not found');
    }

    return await this.prismaService.order.update({
      where: { id: orderId },
      data: { status: dto.status },
    });
  }

  async createPayment(dto: CreatePaymentDto, userId: string) {
    const order = await this.prismaService.order.findUnique({
      where: { id: dto.orderId },
      include: { ticket: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('Order does not belong to this user');
    }

    const existingPayment = await this.prismaService.payment.findUnique({
      where: { orderId: dto.orderId },
    });

    if (existingPayment) {
      throw new ConflictException('A payment already exists for this order');
    }

    return await this.prismaService.payment.create({
      data: {
        amount: dto.amount,
        currency: dto.currency,
        orderId: dto.orderId,
      },
    });
  }

  async updatePayment(paymentId: number, dto: UpdatePaymentDto) {
    const existingPayment = await this.prismaService.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existingPayment) {
      throw new NotFoundException('Payment not found');
    }

    if (dto.orderId) {
      const existingOrderForPayment =
        await this.prismaService.payment.findFirst({
          where: { orderId: dto.orderId, id: { not: paymentId } },
        });

      if (existingOrderForPayment) {
        throw new ConflictException('A payment already exists for this order');
      }
    }

    return await this.prismaService.payment.update({
      where: { id: paymentId },
      data: dto,
    });
  }
}
