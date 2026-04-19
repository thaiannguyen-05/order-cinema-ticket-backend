import { SEAT_STATUS } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class FindSeatDto {
  @IsOptional()
  @IsUUID()
  filmId?: string;

  @IsOptional()
  @IsInt()
  cinemaId?: number;

  @IsOptional()
  @IsEnum(SEAT_STATUS)
  status?: SEAT_STATUS;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsUUID()
  cursor?: string;
}
