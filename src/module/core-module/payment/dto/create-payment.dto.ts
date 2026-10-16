import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

// Client may only name the Ticket + expected price.
// userId comes from JWT (@User), status/sepay fields are gateway-controlled
// and rejected by whitelist+forbidNonWhitelisted if sent.
export class CreatePaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  finalPrice!: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  currency?: string;

  @IsUUID()
  @IsNotEmpty()
  ticketId!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
