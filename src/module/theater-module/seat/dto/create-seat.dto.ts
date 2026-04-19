import { SEAT_STATUS } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateSeatDto {
  @IsInt()
  @Min(1)
  row: number;

  @IsInt()
  @Min(1)
  column: number;

  @IsOptional()
  @IsEnum(SEAT_STATUS)
  status?: SEAT_STATUS;

  @IsUUID()
  filmId: string;

  @IsInt()
  cinemaId: number;
}
