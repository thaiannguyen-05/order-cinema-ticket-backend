import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  currency!: string;

  @IsUUID()
  @IsNotEmpty()
  orderId!: string;
}
