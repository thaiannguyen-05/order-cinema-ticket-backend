import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTicketDto {
  @IsOptional()
  @IsDateString()
  time?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(10000000)
  price!: number;

  @IsUUID()
  @IsNotEmpty()
  filmOfCinemaId!: string;

  @IsUUID()
  @IsNotEmpty()
  seatId!: string;
}
