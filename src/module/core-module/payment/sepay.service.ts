import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from '../../../background/prisma/prisma.service';
import { SepayCallbackDto } from './dto/sepay.callback.dto';

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
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
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

  /**
   * Process SePay callback (IPN / webhook).
   * 1. Extract signature from payload
   * 2. Verify signature via signFields
   * 3. Update payment status in DB
   */
  async handleCallback(dto: SepayCallbackDto) {
    const { signature, ...fields } = dto;

    const expectedSignature = this.signFields(fields);

    if (signature !== expectedSignature) {
      throw new BadRequestException('Invalid SePay signature');
    }

    // Map SePay fields to internal order
    const orderId = dto.order_invoice_number;
    const operation = dto.operation;

    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException(`Order ${orderId} not found`);
    }

    const newStatus =
      operation === 'success' || operation === 'captured'
        ? 'CAPTURED'
        : 'CANCELLED';

    await this.prismaService.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    return { success: true, status: newStatus };
  }
}
