import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class SepayCallbackDto {
  @IsString()
  @IsNotEmpty()
  order_amount!: string;

  @IsString()
  @IsNotEmpty()
  merchant!: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsString()
  @IsNotEmpty()
  operation!: string;

  @IsString()
  @IsNotEmpty()
  order_description!: string;

  @IsString()
  @IsNotEmpty()
  order_invoice_number!: string;

  @IsString()
  @IsNotEmpty()
  customer_id!: string;

  @IsString()
  @IsNotEmpty()
  payment_method!: string;

  @IsUrl()
  @IsNotEmpty()
  success_url!: string;

  @IsUrl()
  @IsNotEmpty()
  error_url!: string;

  @IsUrl()
  @IsNotEmpty()
  cancel_url!: string;

  @IsString()
  @IsNotEmpty()
  signature!: string;
}
