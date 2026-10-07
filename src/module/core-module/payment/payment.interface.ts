import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { UpdatePaymentDto } from './dto/update-payment.dto';
import type { PaymentOrder } from './type';

export interface PaymentInterface {
  createOrder(dto: CreatePaymentDto): Promise<PaymentOrder>;
  updateOrder(id: string, dto: UpdatePaymentDto): Promise<PaymentOrder>;
  getOrder(id: string): Promise<PaymentOrder | null>;
}
