import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

// Client may only name the Ticket + expected price.
// userId comes from JWT (@User), status/sepay fields are gateway-controlled
// and rejected by whitelist+forbidNonWhitelisted if sent.
// expiresAt is server-controlled (now + 15m) and NOT accepted from clients
// to prevent hold-time stretching abuse.
export class CreateOrderDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Min(1)
  @Max(10000000)
  @IsNotEmpty()
  finalPrice!: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsUUID()
  @IsNotEmpty()
  ticketId!: string;
}
