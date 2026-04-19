import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateMomoPaymentDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  orderId: string;

  @IsString()
  orderInfo: string;

  @IsOptional()
  @IsString()
  extraData?: string;

  @IsOptional()
  @IsIn(['vi', 'en'])
  lang?: 'vi' | 'en';

  @IsUUID()
  ticketId: string;
}
