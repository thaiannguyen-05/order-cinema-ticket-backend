import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { Throttle } from '@nestjs/throttler';
import { User } from '../../../core/decorator/user.decorator';
import { Public } from '../../../core/decorator/ispublic.decorator';
import { SepayService } from './sepay.service';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { SepayCheckoutDto } from './dto/sepay-checkout.dto';
import { SepayWebhookDto } from './dto/sepay-webhook.dto';
import { SEPAY } from './constant';

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

  // Browser redirects from Sepay (success/error/cancel_url). Public with
  // signed ?token= (HMAC orderId.userId.exp). Never mark PAID here; IPN
  // webhook is the source of truth for PAID.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Get('sepay/success/:orderId')
  @ApiOperation({ summary: 'Sepay success return (read order status)' })
  @ApiOkResponse({ description: 'Order status for success return' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  handleSepaySuccess(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('token') token?: string,
  ) {
    return this.sepayService.handleBrowserReturn(orderId, 'success', token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Get('sepay/error/:orderId')
  @ApiOperation({
    summary: 'Sepay error return (read-only, FAILED only via IPN)',
  })
  @ApiOkResponse({ description: 'Order status for error return' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  handleSepayError(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('token') token?: string,
  ) {
    return this.sepayService.handleBrowserReturn(orderId, 'error', token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Get('sepay/cancel/:orderId')
  @ApiOperation({ summary: 'Sepay cancel return (PENDING -> CANCELLED)' })
  @ApiOkResponse({ description: 'Order status for cancel return' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  handleSepayCancel(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('token') token?: string,
  ) {
    return this.sepayService.handleBrowserReturn(orderId, 'cancel', token);
  }

  @Post('sepay/sync/:orderId')
  @ApiOperation({ summary: 'Sync order status (ownership-checked poll)' })
  @ApiOkResponse({ description: 'DB order status, lazy-expire if past TTL' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  syncSepayOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @User('id') userId: string,
  ) {
    return this.sepayService.syncOrder(orderId, userId);
  }

  // NOTE: kept @Public() on purpose. Sepay servers call this endpoint and
  // have no user JWT. Auth is via `X-Secret-Key: <SEPAY_SECRET_KEY>` header
  // verified in SepayService (see Sepay IPN docs). Removing @Public() and
  // requiring JWT would break every real callback with 401.
  @Public()
  @Post('sepay/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SePay payment notification webhook' })
  @ApiOkResponse({ description: 'Notification received' })
  @ApiBadRequestResponse({ description: 'Invalid webhook payload' })
  handleSepayWebhook(
    @Body() dto: SepayWebhookDto,
    @Headers(SEPAY.WEBHOOK_SECRET_HEADER) secretKey?: string,
  ) {
    return this.sepayService.handleWebhook(dto, secretKey);
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
}
