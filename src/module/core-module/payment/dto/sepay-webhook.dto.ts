import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

// Wire contract mirrors SePay ORDER_PAID notification verbatim.
// Domain mapping (see CONTEXT.md):
// - SePay `order` = SePay gateway order, not domain `Order` (user's request for one Ticket).
// - SePay `transaction` = SePay payment attempt, not domain `Payment` (avoid: Transaction).
// - SePay `customer.customer_id` = domain `User.id` (avoid: Customer).
export class SepayWebhookOrderDto {
  @IsUUID()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @IsString()
  @IsNotEmpty()
  order_status!: string;

  @IsString()
  @IsNotEmpty()
  order_currency!: string;

  @IsString()
  @IsNotEmpty()
  order_amount!: string;

  @IsString()
  @IsNotEmpty()
  order_invoice_number!: string;

  @IsOptional()
  @IsArray()
  custom_data?: unknown[];

  @IsOptional()
  @IsString()
  user_agent?: string;

  @IsOptional()
  @IsString()
  ip_address?: string;

  @IsOptional()
  @IsString()
  order_description?: string;
}

export class SepayWebhookTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  payment_method!: string;

  @IsString()
  @IsNotEmpty()
  transaction_id!: string;

  @IsString()
  @IsNotEmpty()
  transaction_type!: string;

  @IsString()
  @IsNotEmpty()
  transaction_date!: string;

  @IsString()
  @IsNotEmpty()
  transaction_status!: string;

  @IsString()
  @IsNotEmpty()
  transaction_amount!: string;

  @IsString()
  @IsNotEmpty()
  transaction_currency!: string;

  @IsOptional()
  @IsString()
  authentication_status?: string;

  @IsOptional()
  @IsString()
  card_number?: string;

  @IsOptional()
  @IsString()
  card_holder_name?: string;

  @IsOptional()
  @IsString()
  card_expiry?: string;

  @IsOptional()
  @IsString()
  card_funding_method?: string;

  @IsOptional()
  @IsString()
  card_brand?: string;
}

export class SepayWebhookCustomerDto {
  @IsUUID()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  customer_id!: string;
}

export class SepayWebhookDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  timestamp?: number;

  @IsString()
  @IsNotEmpty()
  notification_type!: string;

  @ValidateNested()
  @Type(() => SepayWebhookOrderDto)
  order!: SepayWebhookOrderDto;

  @ValidateNested()
  @Type(() => SepayWebhookTransactionDto)
  transaction!: SepayWebhookTransactionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SepayWebhookCustomerDto)
  customer?: SepayWebhookCustomerDto;
}
