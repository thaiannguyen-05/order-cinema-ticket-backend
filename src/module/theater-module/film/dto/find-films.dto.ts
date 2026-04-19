import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FindFilmsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  cursor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
