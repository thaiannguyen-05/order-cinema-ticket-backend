import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import axios from 'axios';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../../background/prisma/prisma.service';
import { RedisLockService } from '../../../background/redis/redis.lock.service';
import { PAYMENT_LOCK_KEY, PAYMENT_LOCK_TTL_MS, SEPAY } from './constant';
import type { SepayCheckoutForm, SepayCheckoutResult } from './type';

// Field order for the HMAC-SHA256 (base64) signature. Assumption: SePay signs
// the pipe-joined field values in form order. Confirm against SePay merchant
// docs if checkout init rejects the signature.
const SEPAY_SIGN_FIELDS = [
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

@Injectable()
export class SepayService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisLockService: RedisLockService,
    private readonly configService: ConfigService,
  ) {}

  private signCheckout(
    payload: Omit<SepayCheckoutForm, 'signature'>,
    secret: string,
  ): string {
    const message = SEPAY_SIGN_FIELDS.map((field) => payload[field]).join('|');
    return createHmac('sha256', secret)
      .update(message, 'utf8')
      .digest('base64');
  }

  async initCheckout(
    orderId: string,
    userId: string,
  ): Promise<SepayCheckoutResult> {
    const result =
      await this.redisLockService.runExclusive<SepayCheckoutResult>(
        PAYMENT_LOCK_KEY.CHECKOUT_BY_INVOICE(orderId),
        PAYMENT_LOCK_TTL_MS.CHECKOUT,
        async () => {
          const order = await this.prismaService.order.findFirst({
            where: { id: orderId, userId },
          });

          if (!order) {
            throw new NotFoundException('Order not found');
          }

          if (order.status === OrderStatus.PAID) {
            throw new ConflictException('Order already paid');
          }

          const unsigned: Omit<SepayCheckoutForm, 'signature'> = {
            merchant: this.configService.getOrThrow<string>('SEPAY_MERCHANT'),
            currency: order.currency,
            order_amount: String(order.finalPrice),
            operation: SEPAY.OPERATION,
            order_description: `Thanh toán đơn hàng #${order.id.slice(0, 8)}`,
            order_invoice_number: order.id,
            customer_id: order.userId,
            success_url:
              this.configService.getOrThrow<string>('SEPAY_SUCCESS_URL'),
            error_url: this.configService.getOrThrow<string>('SEPAY_ERROR_URL'),
            cancel_url:
              this.configService.getOrThrow<string>('SEPAY_CANCEL_URL'),
          };
          const form: SepayCheckoutForm = {
            ...unsigned,
            signature: this.signCheckout(
              unsigned,
              this.configService.getOrThrow<string>('SEPAY_SECRET_KEY'),
            ),
          };

          let checkoutUrl: string;
          try {
            const { data } = await axios.post<unknown>(
              `${this.configService
                .get<string>('SEPAY_BASE_URL', SEPAY.BASE_URL)
                .replace(/\/+$/, '')}${SEPAY.CHECKOUT_PATH}`,
              new URLSearchParams(form).toString(),
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: SEPAY.TIMEOUT_MS,
              },
            );
            // Assumption: SePay answers JSON with `checkout_url` (or camelCase
            // `checkoutUrl`). Adjust if merchant docs name it differently.
            const record = data as Record<string, unknown>;
            const url = record['checkout_url'] ?? record['checkoutUrl'];
            if (typeof url !== 'string' || url.length === 0) {
              throw new Error('Missing checkout_url in SePay response');
            }
            checkoutUrl = url;
          } catch (error) {
            throw new ServiceUnavailableException(
              'SePay checkout unavailable',
              error instanceof Error ? error.message : undefined,
            );
          }

          await this.prismaService.order.update({
            where: { id: order.id },
            data: { paymentMethod: 'SEPAY' },
          });

          return { orderId: order.id, checkoutUrl };
        },
      );

    if (result === null) {
      throw new ConflictException(
        'Checkout already in progress for this order',
      );
    }

    return result;
  }
}
