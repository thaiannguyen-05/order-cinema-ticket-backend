import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class SepayCallbackDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : String(value).trim(),
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/)
  @MaxLength(15)
  order_amount!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  merchant!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/)
  @MaxLength(3)
  currency!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  operation!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  order_description!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  order_invoice_number!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customer_id!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  payment_method!: string;

  @IsUrl()
  @IsNotEmpty()
  @MaxLength(2048)
  success_url!: string;

  @IsUrl()
  @IsNotEmpty()
  @MaxLength(2048)
  error_url!: string;

  @IsUrl()
  @IsNotEmpty()
  @MaxLength(2048)
  cancel_url!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  signature!: string;
}
