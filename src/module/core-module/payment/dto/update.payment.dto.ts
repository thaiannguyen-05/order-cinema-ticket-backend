import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdatePaymentDto {
  @IsInt()
  @IsPositive()
  @IsOptional()
  amount?: number;

  @IsString()
  @Length(3, 3)
  @IsOptional()
  currency?: string;

  @IsEnum(OrderStatus)
  @IsOptional()
  orderStatus?: OrderStatus;

  @IsUUID()
  @IsOptional()
  orderId?: string;
}
