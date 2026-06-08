import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class SepayCheckoutDto {
  @IsNumber()
  @Min(1)
  order_amount!: number;

  @IsString()
  @IsOptional()
  merchant?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currency!: string;

  @IsString()
  @IsOptional()
  operation?: string;

  @IsString()
  @IsNotEmpty()
  order_description!: string;

  @IsString()
  @IsNotEmpty()
  order_invoice_number!: string;

  @IsUrl()
  @IsNotEmpty()
  success_url!: string;

  @IsUrl()
  @IsNotEmpty()
  error_url!: string;

  @IsUrl()
  @IsNotEmpty()
  cancel_url!: string;
}
