import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma, TicketStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../infra/prisma/prisma.service';
import { RedisLockService } from '../infra/redis/redis.lock.service';
import { MetricsService } from '../infra/metrics/metrics.service';
import {
  PAYMENT_LOCK_KEY,
  PAYMENT_LOCK_TTL_MS,
  SEPAY,
  SEPAY_NOTIFICATION_TYPE,
  SEPAY_SUCCESS_ORDER_STATUSES,
  SEPAY_SUCCESS_TRANSACTION_STATUSES,
} from './constant';
import {
  SEPAY_SIGN_FIELDS,
  type SepayCheckoutForm,
  type SepayCheckoutResult,
  type SepayWebhookResult,
} from './type';
import type { SepayWebhookDto } from './dto/sepay-webhook.dto';
import type { PaymentOrder } from './type';

export type SepayBrowserOutcome = 'success' | 'error' | 'cancel';

// Signed browser-return token TTL: 30 minutes (covers 15m order TTL + buffer).
const SEPAY_RETURN_TOKEN_TTL_S = 30 * 60;

@Injectable()
export class SepayService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisLockService: RedisLockService,
    private readonly configService: ConfigService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  private signCheckout(
    payload: Omit<SepayCheckoutForm, 'signature'>,
    secret: string,
  ): string {
    // Per Sepay docs: `field=value` joined by `,`, skip absent optionals.
    const signingString = SEPAY_SIGN_FIELDS.filter(
      (field) =>
        payload[field] !== undefined &&
        payload[field] !== null &&
        payload[field] !== '',
    )
      .map((field) => `${field}=${payload[field]}`)
      .join(',');
    return createHmac('sha256', secret)
      .update(signingString, 'utf8')
      .digest('base64');
  }

  private buildReturnToken(orderId: string, userId: string): string {
    const secret = this.configService.getOrThrow<string>('SEPAY_SECRET_KEY');
    const exp = Math.floor(Date.now() / 1000) + SEPAY_RETURN_TOKEN_TTL_S;
    const data = `${orderId}.${userId}.${exp}`;
    const sig = createHmac('sha256', secret)
      .update(data, 'utf8')
      .digest('base64url');
    return `${exp}.${sig}`;
  }

  private verifyReturnToken(
    order: PaymentOrder,
    token: string | undefined,
  ): void {
    if (!token) {
      throw new UnauthorizedException('Missing return token');
    }
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid return token');
    }
    const exp = Number(parts[0]);
    const sig = parts[1];
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Return token expired');
    }
    const secret = this.configService.getOrThrow<string>('SEPAY_SECRET_KEY');
    const data = `${order.id}.${order.userId}.${exp}`;
    const expected = createHmac('sha256', secret)
      .update(data, 'utf8')
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid return token');
    }
  }

  private async requireOrder(
    id: string,
    userId?: string,
  ): Promise<PaymentOrder> {
    const order = userId
      ? await this.prismaService.order.findFirst({ where: { id, userId } })
      : await this.prismaService.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private async saveStatus(
    orderId: string,
    data: Prisma.OrderUpdateInput,
  ): Promise<PaymentOrder> {
    try {
      return await this.prismaService.order.update({
        where: { id: orderId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Duplicate Sepay reference');
      }
      throw error;
    }
  }

  /**
   * Single IPN settler: validate + map notification to OrderStatus + persist.
   * Sepay `notification_type` != browser return != domain `OrderStatus`.
   * Only IPN may decide PAID.
   */
  private async applyIpn(
    order: PaymentOrder,
    dto: SepayWebhookDto,
  ): Promise<SepayWebhookResult> {
    if (
      dto.customer?.customer_id &&
      dto.customer.customer_id !== order.userId
    ) {
      throw new BadRequestException('Customer mismatch');
    }
    if (
      dto.order.order_currency !== order.currency ||
      dto.transaction.transaction_currency !== order.currency
    ) {
      throw new BadRequestException('Currency mismatch');
    }

    const toNumber = (raw: unknown, field: string): number => {
      const n =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? Number(raw.trim())
            : NaN;
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException(`Invalid ${field}`);
      }
      return n;
    };
    const txAmount = toNumber(
      dto.transaction.transaction_amount,
      'transaction_amount',
    );
    const orderAmount = toNumber(dto.order.order_amount, 'order_amount');
    if (
      Math.round(txAmount) !== order.finalPrice ||
      Math.round(orderAmount) !== order.finalPrice
    ) {
      throw new ConflictException('Amount mismatch');
    }

    let nextStatus: OrderStatus;
    if (dto.notification_type === SEPAY_NOTIFICATION_TYPE.ORDER_PAID) {
      const ok =
        (SEPAY_SUCCESS_ORDER_STATUSES as readonly string[]).includes(
          dto.order.order_status,
        ) &&
        (SEPAY_SUCCESS_TRANSACTION_STATUSES as readonly string[]).includes(
          dto.transaction.transaction_status,
        );
      nextStatus = ok ? OrderStatus.PAID : OrderStatus.FAILED;
    } else if (
      dto.notification_type === SEPAY_NOTIFICATION_TYPE.TRANSACTION_VOID
    ) {
      nextStatus = OrderStatus.CANCELLED;
    } else {
      throw new BadRequestException('Unsupported notification_type');
    }

    if (order.status === nextStatus) {
      return { orderId: order.id, status: order.status, idempotent: true };
    }
    // Terminal states are immutable. Ack with 200 idempotent:true so Sepay
    // stops retrying a notification that can never be applied.
    if (order.status !== OrderStatus.PENDING) {
      return { orderId: order.id, status: order.status, idempotent: true };
    }

    if (nextStatus === OrderStatus.PAID) {
      try {
        const updated = await this.prismaService.$transaction(async (tx) => {
          const paid = await tx.order.update({
            where: { id: order.id },
            data: {
              status: nextStatus,
              sepayOrderId: dto.order.order_id,
              sepayTransactionId: dto.transaction.transaction_id,
              paymentMethod: dto.transaction.payment_method,
              paidAmount: Math.round(txAmount),
              callbackPayload: JSON.parse(JSON.stringify(dto)),
            },
          });
          const ticket = await tx.ticket.findUnique({
            where: { id: order.ticketId },
          });
          if (!ticket) {
            throw new NotFoundException('Ticket not found');
          }
          // Seat is reusable across ShowTimes; BOOKED lives on Ticket.
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { ticketStatus: TicketStatus.BOOKED },
          });
          return paid;
        });
        return {
          orderId: updated.id,
          status: updated.status,
          idempotent: false,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('Duplicate Sepay reference');
        }
        throw error;
      }
    }

    const updated = await this.saveStatus(order.id, {
      status: nextStatus,
      sepayOrderId: dto.order.order_id,
      sepayTransactionId: dto.transaction.transaction_id,
      paymentMethod: dto.transaction.payment_method,
      paidAmount: Math.round(txAmount),
      callbackPayload: JSON.parse(JSON.stringify(dto)),
    });
    // Release the hold so the ticket can be retried: PROCESSING -> AVAILABLE.
    await this.prismaService.ticket.updateMany({
      where: { id: order.ticketId, ticketStatus: TicketStatus.PROCESSING },
      data: { ticketStatus: TicketStatus.AVAILABLE },
    });
    return { orderId: updated.id, status: updated.status, idempotent: false };
  }

  async initCheckout(
    orderId: string,
    userId: string,
  ): Promise<SepayCheckoutResult> {
    try {
      const result = await this.doInitCheckout(orderId, userId);
      this.metrics?.incCheckout('success');
      return result;
    } catch (error) {
      this.metrics?.incCheckout(
        error instanceof ConflictException ? 'conflict' : 'error',
      );
      throw error;
    }
  }

  private async doInitCheckout(
    orderId: string,
    userId: string,
  ): Promise<SepayCheckoutResult> {
    const result =
      await this.redisLockService.runExclusive<SepayCheckoutResult>(
        PAYMENT_LOCK_KEY.CHECKOUT_BY_INVOICE(orderId),
        PAYMENT_LOCK_TTL_MS.CHECKOUT,
        async () => {
          const order = await this.requireOrder(orderId, userId);

          if (order.status === OrderStatus.PAID) {
            throw new ConflictException('Order already paid');
          }

          // Build per-order return urls so Sepay redirects back to the
          // endpoint serving that order: supports `{orderId}` placeholder,
          // `?orderId=` query, or REST `/<orderId>` suffix.
          // e.g. base `https://api.../payment/sepay/success`
          //   -> `https://api.../payment/sepay/success/<orderId>?token=<signed>`
          const withOrderId = (base: string): string => {
            if (base.includes('{orderId}')) {
              return base.replace('{orderId}', order.id);
            }
            if (base.includes('?')) {
              const sep = base.endsWith('?') || base.endsWith('&') ? '' : '&';
              return `${base}${sep}orderId=${order.id}`;
            }
            return `${base.replace(/\/+$/, '')}/${order.id}`;
          };
          const withToken = (url: string, token: string): string => {
            const sep = url.includes('?') ? '&' : '?';
            return `${url}${sep}token=${encodeURIComponent(token)}`;
          };

          const returnToken = this.buildReturnToken(order.id, order.userId);

          const unsigned: Omit<SepayCheckoutForm, 'signature'> = {
            merchant: this.configService.getOrThrow<string>('SEPAY_MERCHANT'),
            currency: order.currency,
            order_amount: String(order.finalPrice),
            operation: SEPAY.OPERATION,
            order_description: `Thanh toán đơn hàng #${order.id.slice(0, 8)}`,
            order_invoice_number: order.id,
            customer_id: order.userId,
            success_url: withToken(
              withOrderId(
                this.configService.getOrThrow<string>('SEPAY_SUCCESS_URL'),
              ),
              returnToken,
            ),
            error_url: withToken(
              withOrderId(
                this.configService.getOrThrow<string>('SEPAY_ERROR_URL'),
              ),
              returnToken,
            ),
            cancel_url: withToken(
              withOrderId(
                this.configService.getOrThrow<string>('SEPAY_CANCEL_URL'),
              ),
              returnToken,
            ),
          };
          const form: SepayCheckoutForm = {
            ...unsigned,
            signature: this.signCheckout(
              unsigned,
              this.configService.getOrThrow<string>('SEPAY_SECRET_KEY'),
            ),
          };

          // SePay checkout/init is a browser form POST, not a JSON API
          // (docs: form-thanh-toan returns 302 to /v1/checkout, no checkout_url).
          // Never axios.post from server here; return signed fields so the
          // caller (browser/WebView/Swagger) submits the form itself.
          const action = `${this.configService
            .get<string>('SEPAY_BASE_URL', SEPAY.BASE_URL)
            .replace(/\/+$/, '')}${SEPAY.CHECKOUT_PATH}`;

          await this.prismaService.order.update({
            where: { id: order.id },
            data: { paymentMethod: 'SEPAY' },
          });

          return {
            orderId: order.id,
            action,
            method: 'POST' as const,
            fields: form,
          };
        },
      );

    if (result === null) {
      throw new ConflictException(
        'Checkout already in progress for this order',
      );
    }

    return result;
  }

  async handleWebhook(
    dto: SepayWebhookDto,
    secretKeyHeader: string | undefined,
  ): Promise<SepayWebhookResult> {
    try {
      const result = await this.doHandleWebhook(dto, secretKeyHeader);
      if (result.idempotent) {
        this.metrics?.incWebhook('idempotent');
      } else if (result.status === OrderStatus.PAID) {
        this.metrics?.incWebhook('paid');
      } else if (result.status === OrderStatus.FAILED) {
        this.metrics?.incWebhook('failed');
      } else if (result.status === OrderStatus.CANCELLED) {
        this.metrics?.incWebhook('cancelled');
      } else {
        this.metrics?.incWebhook('idempotent');
      }
      return result;
    } catch (error) {
      this.metrics?.incWebhook('error');
      throw error;
    }
  }

  private async doHandleWebhook(
    dto: SepayWebhookDto,
    secretKeyHeader: string | undefined,
  ): Promise<SepayWebhookResult> {
    const secret = this.configService.get<string>('SEPAY_SECRET_KEY');
    if (secret && secret !== 'REPLACE_ME') {
      if (!secretKeyHeader) {
        throw new UnauthorizedException('Missing webhook secret');
      }
      const a = Buffer.from(secretKeyHeader, 'utf8');
      const b = Buffer.from(secret, 'utf8');
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException('Invalid webhook secret');
      }
    }

    const invoiceNumber = dto.order?.order_invoice_number;
    if (!invoiceNumber) {
      throw new BadRequestException('Missing order_invoice_number');
    }

    // Replay guard: Sepay IPN carries Unix timestamp (seconds).
    // Reject payloads older than 5m (replayed callbacks keep their original
    // timestamp). Future-skewed timestamps are accepted: Sepay testmode clock
    // runs ahead, and a future date cannot be a replay of an old message.
    if (dto.timestamp !== undefined && dto.timestamp !== null) {
      const tsMs =
        typeof dto.timestamp === 'number' ? dto.timestamp * 1000 : Number.NaN;
      if (!Number.isFinite(tsMs)) {
        throw new BadRequestException('Invalid timestamp');
      }
      if (Date.now() - tsMs > 5 * 60 * 1000) {
        throw new BadRequestException('Stale webhook timestamp');
      }
    }

    // Unified settle lock with browser return (same orderId) to prevent
    // PENDING->CANCELLED vs PENDING->PAID race.
    const result = await this.redisLockService.runExclusive<SepayWebhookResult>(
      PAYMENT_LOCK_KEY.UPDATE_BY_ORDER(invoiceNumber),
      PAYMENT_LOCK_TTL_MS.WEBHOOK,
      async () => this.applyIpn(await this.requireOrder(invoiceNumber), dto),
    );

    if (result === null) {
      throw new ConflictException('Webhook already in progress for this order');
    }

    return result;
  }

  /**
   * Ownership-checked poll for frontend: returns DB status, lazily expires
   * a PENDING order past expiresAt instead of waiting for the 5m cron.
   * Remote Sepay PG query (https://pgapi.sepay.vn, Basic merchant:secret)
   * to be wired here once the invoice-lookup contract is confirmed;
   * until then IPN remains the only path to PAID.
   */
  async syncOrder(
    orderId: string,
    userId: string,
  ): Promise<SepayWebhookResult> {
    try {
      const result = await this.doSyncOrder(orderId, userId);
      this.metrics?.incSync(
        result.status === OrderStatus.EXPIRED ? 'expired' : 'ok',
      );
      return result;
    } catch (error) {
      this.metrics?.incSync('error');
      throw error;
    }
  }

  private async doSyncOrder(
    orderId: string,
    userId: string,
  ): Promise<SepayWebhookResult> {
    const result = await this.redisLockService.runExclusive<SepayWebhookResult>(
      PAYMENT_LOCK_KEY.UPDATE_BY_ORDER(orderId),
      PAYMENT_LOCK_TTL_MS.UPDATE,
      async () => {
        const order = await this.requireOrder(orderId, userId);
        if (
          order.status === OrderStatus.PENDING &&
          order.expiresAt &&
          order.expiresAt.getTime() <= Date.now()
        ) {
          const updated = await this.saveStatus(order.id, {
            status: OrderStatus.EXPIRED,
          });
          await this.prismaService.ticket.updateMany({
            where: {
              id: order.ticketId,
              ticketStatus: TicketStatus.PROCESSING,
            },
            data: { ticketStatus: TicketStatus.AVAILABLE },
          });
          return {
            orderId: updated.id,
            status: updated.status,
            idempotent: false,
          };
        }
        return { orderId: order.id, status: order.status, idempotent: true };
      },
    );
    if (result === null) {
      throw new ConflictException(
        'Order update is already in progress for this order',
      );
    }
    return result;
  }

  /**
   * Single browser-return handler serving all 3 redirect urls.
   * Public (signed ?token=), success/error = read-only (FAILED only via IPN);
   * cancel PENDING -> CANCELLED.
   * Never marks PAID, never downgrades PAID, never touches Ticket/Seat.
   */
  async handleBrowserReturn(
    orderId: string,
    outcome: SepayBrowserOutcome,
    token: string | undefined,
  ): Promise<SepayWebhookResult> {
    const result = await this.redisLockService.runExclusive<SepayWebhookResult>(
      PAYMENT_LOCK_KEY.UPDATE_BY_ORDER(orderId),
      PAYMENT_LOCK_TTL_MS.UPDATE,
      async () => {
        const order = await this.requireOrder(orderId);
        this.verifyReturnToken(order, token);
        if (outcome !== 'cancel' || order.status !== OrderStatus.PENDING) {
          return { orderId: order.id, status: order.status, idempotent: true };
        }
        const nextStatus = OrderStatus.CANCELLED;
        const updated = await this.saveStatus(order.id, {
          status: nextStatus,
        });
        await this.prismaService.ticket.updateMany({
          where: { id: order.ticketId, ticketStatus: TicketStatus.PROCESSING },
          data: { ticketStatus: TicketStatus.AVAILABLE },
        });
        return {
          orderId: updated.id,
          status: updated.status,
          idempotent: false,
        };
      },
    );
    if (result === null) {
      throw new ConflictException(
        'Order update is already in progress for this order',
      );
    }
    return result;
  }
}
