import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class CreateTicketDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(10000000)
  price!: number;

  @IsUUID()
  @IsNotEmpty()
  showTimeId!: string;

  @IsUUID()
  @IsNotEmpty()
  seatId!: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  ticketStatus?: TicketStatus;
}
