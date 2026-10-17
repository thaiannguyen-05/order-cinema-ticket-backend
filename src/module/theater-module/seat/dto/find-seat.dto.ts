import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SeatStatus, SeatType } from '@prisma/client';

export class FindSeatDto {
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsEnum(SeatType)
  seatType?: SeatType;

  @IsOptional()
  @IsEnum(SeatStatus)
  seatStatus?: SeatStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
}
