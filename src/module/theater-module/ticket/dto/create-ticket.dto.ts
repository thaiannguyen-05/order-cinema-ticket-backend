import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTicketDto {
  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsNumber()
  price: number;

  @IsUUID()
  filmOfCinemaId: string;

  @IsUUID()
  seatId: string;
}
