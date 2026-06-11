import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisLockService } from '../../../background/redis/redis.lock.service';
import {
  REDIS_LOCK_KEY,
  REDIS_TTL,
} from '../../../background/redis/redis.value';
import { SepayCallbackDto } from './dto/sepay.callback.dto';
import { SepayCheckoutDto } from './dto/sepay.checkout.dto';
import { toIntAmount, toDecimalAmount } from './amount.converter';
import { OrderRepository } from './repository/order.repository';
import { OrderStatus } from '@prisma/client';

const ALLOWED_FIELDS = [
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

@Injectable()
export class SepayService {
  private readonly SEPAY_CHECKOUT_URL = 'https://pay.sepay.vn/v1/checkout/init';

  constructor(
    private readonly configService: ConfigService,
    private readonly orderRepository: OrderRepository,
    private readonly redisLockService: RedisLockService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Generate HMAC-SHA256 signature matching SePay PHP reference:
   *   signFields(array $fields, string $secretKey): string
   */
  signFields(fields: Record<string, string>): string {
    const secretKey = this.configService.getOrThrow<string>('SEPAY_SECRET_KEY');

    const signed: string[] = [];

    for (const field of ALLOWED_FIELDS) {
      if (fields[field] !== undefined) {
        signed.push(`${field}=${fields[field]}`);
      }
    }

    const data = signed.join(',');
    const hmac = createHmac('sha256', secretKey);
    hmac.update(data);

    return hmac.digest('base64');
  }

  async createCheckoutUrl(dto: SepayCheckoutDto, userId: string) {
    const lockKey = REDIS_LOCK_KEY.SEPAY_CHECKOUT(dto.order_invoice_number);

    const result = await this.redisLockService.runExclusive(
      lockKey,
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        const existingOrder = await this.orderRepository.findOrderByIdAndUserId(
          dto.order_invoice_number,
          userId,
        );

        if (!existingOrder) {
          throw new BadRequestException('Order not found');
        }

        const existingPayment = await this.orderRepository.findPaymentByOrderId(
          existingOrder.id,
        );

        if (existingPayment) {
          throw new ConflictException('This order has already been paid');
        }

        const merchant =
          dto.merchant ??
          this.configService.getOrThrow<string>('SEPAY_MERCHANT');
        const operation = dto.operation ?? 'PURCHASE';

        const fields: Record<string, string> = {
          order_amount: String(dto.order_amount),
          merchant,
          currency: dto.currency,
          operation,
          order_description: dto.order_description,
          order_invoice_number: dto.order_invoice_number,
          customer_id: userId,
          success_url: dto.success_url,
          error_url: dto.error_url,
          cancel_url: dto.cancel_url,
        };

        const signature = this.signFields(fields);

        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(fields)) {
          formData.append(key, value);
        }
        formData.append('signature', signature);

        const response = await firstValueFrom(
          this.httpService.postForm(this.SEPAY_CHECKOUT_URL, formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }),
        );

        return response.data as { checkout_url?: string };
      },
    );

    if (!result) {
      throw new ConflictException(
        'A checkout request is being processed, please try again',
      );
    }

    if (!result.checkout_url) {
      throw new ServiceUnavailableException('SePay returned no checkout URL');
    }

    return { checkout_url: result.checkout_url };
  }

  async handleCallback(dto: SepayCallbackDto) {
    const { signature, ...fields } = dto;

    const expectedSignature = this.signFields(fields);

    if (signature !== expectedSignature) {
      throw new BadRequestException('Invalid SePay signature');
    }

    // Map SePay fields to internal order
    const orderId = dto.order_invoice_number;
    const operation = dto.operation;

    const order = await this.orderRepository.findOrderById(orderId);

    if (!order) {
      throw new BadRequestException(`Order ${orderId} not found`);
    }

    // Convert decimal amount from SePay → Int for DB storage
    const amountInt = toIntAmount(Number(dto.order_amount));

    const newStatus =
      operation === 'success' || operation === 'captured'
        ? OrderStatus.CAPTURED
        : OrderStatus.CANCELLED;

    await this.orderRepository.updateOrderAndUpsertPayment(orderId, newStatus, {
      orderId,
      amount: amountInt,
      currency: dto.currency,
    });

    return {
      success: true,
      status: newStatus,
      amount: toDecimalAmount(amountInt),
    };
  }
}
