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
import { SEAT_STATUS } from '@prisma/client';

export class CreateSeatDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(50)
  row!: number;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(50)
  column!: number;

  @IsOptional()
  @IsEnum(SEAT_STATUS)
  status?: SEAT_STATUS;

  @IsUUID()
  @IsNotEmpty()
  filmId!: string;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  cinemaId!: number;
}
