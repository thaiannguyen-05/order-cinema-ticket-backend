import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SeatStatus, SeatType } from '@prisma/client';

export class CreateSeatDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10)
  row!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10)
  column!: string;

  @IsEnum(SeatType)
  @IsNotEmpty()
  seatType!: SeatType;

  @IsOptional()
  @IsEnum(SeatStatus)
  seatStatus?: SeatStatus = SeatStatus.AVAILABLE;

  @IsOptional()
  @IsUUID()
  roomId?: string;
}
