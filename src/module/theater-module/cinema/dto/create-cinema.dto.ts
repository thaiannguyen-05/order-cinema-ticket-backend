import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateCinemaDto {
  @IsInt()
  cinema_id: number;

  @IsString()
  cinema_name: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  address2?: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsString()
  postcode: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  logo_url: string;
}
