import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '../../../core/decorator/user.decorator';
import { SepayService } from './sepay.service';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { SepayCheckoutDto } from './dto/sepay-checkout.dto';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly sepayService: SepayService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create an order' })
  @ApiCreatedResponse({ description: 'Order created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid order payload' })
  @ApiConflictResponse({ description: 'Ticket already ordered' })
  createOrder(@Body() dto: CreatePaymentDto, @User('id') userId: string) {
    return this.paymentService.createOrder({ ...dto, userId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order status by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    schema: {
      type: 'string',
      format: 'uuid',
      example: '123e4567-e89b-12d3-a456-426614174000',
    },
  })
  @ApiOkResponse({ description: 'Order updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid update payload' })
  updateOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.paymentService.updateOrder(id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    schema: {
      type: 'string',
      format: 'uuid',
      example: '123e4567-e89b-12d3-a456-426614174000',
    },
  })
  @ApiOkResponse({ description: 'Order retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async getOrder(@Param('id', ParseUUIDPipe) id: string) {
    const order = await this.paymentService.getOrder(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  @Post('sepay/checkout')
  @ApiOperation({ summary: 'Init SePay checkout for an order' })
  @ApiOkResponse({ description: 'SePay checkout URL created' })
  @ApiBadRequestResponse({ description: 'Invalid checkout payload' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order already paid or checkout busy' })
  @ApiServiceUnavailableResponse({ description: 'SePay checkout unavailable' })
  initSepayCheckout(@Body() dto: SepayCheckoutDto, @User('id') userId: string) {
    return this.sepayService.initCheckout(dto.orderId, userId);
  }
}
