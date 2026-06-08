import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreateOrderDto } from './dto/create.order.dto';
import { UpdateOrderDto } from './dto/update.order.dto';
import { CreatePaymentDto } from './dto/create.payment.dto';
import { UpdatePaymentDto } from './dto/update.payment.dto';
import { User } from '../../../core/decorator/user.decorator';
import { SepayService } from './sepay.service';
import { SepayCallbackDto } from './dto/sepay.callback.dto';

@ApiTags('payment')
@ApiBearerAuth()
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly sepayService: SepayService,
  ) {}

  @Post('order')
  @ApiOperation({ summary: 'Create a new order from a ticket' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({
    status: 403,
    description: 'Ticket does not belong to this user',
  })
  @ApiResponse({
    status: 409,
    description: 'Order already exists for this ticket',
  })
  async createOrder(@Body() dto: CreateOrderDto, @User('id') userId: string) {
    return this.paymentService.createOrder(dto, userId);
  }

  @Patch('order/:id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrderStatus(
    @Param('id') orderId: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.paymentService.updateOrderStatus(orderId, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new payment for an order' })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({
    status: 403,
    description: 'Order does not belong to this user',
  })
  @ApiResponse({
    status: 409,
    description: 'Payment already exists for this order',
  })
  async createPayment(
    @Body() dto: CreatePaymentDto,
    @User('id') userId: string,
  ) {
    return this.paymentService.createPayment(dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update payment details' })
  @ApiResponse({ status: 200, description: 'Payment updated successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({
    status: 409,
    description: 'Payment already exists for this order',
  })
  async updatePayment(
    @Param('id') paymentId: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.paymentService.updatePayment(Number(paymentId), dto);
  }

  @Post('sepay/callback')
  @ApiOperation({ summary: 'SePay callback handler' })
  @ApiResponse({ status: 200, description: 'Callback processed' })
  @ApiResponse({ status: 400, description: 'Invalid signature' })
  async sepayCallback(@Body() dto: SepayCallbackDto) {
    return this.sepayService.handleCallback(dto);
  }
}
