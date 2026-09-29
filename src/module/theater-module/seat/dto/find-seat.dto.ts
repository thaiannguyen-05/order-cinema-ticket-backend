import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SEAT_STATUS } from '@prisma/client';

export class FindSeatDto {
  @IsOptional()
  @IsUUID()
  filmId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cinemaId?: number;

  @IsOptional()
  @IsEnum(SEAT_STATUS)
  status?: SEAT_STATUS;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsUUID()
  cursor?: string;
}
