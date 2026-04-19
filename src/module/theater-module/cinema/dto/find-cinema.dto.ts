import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FindCinemaDto {
  @IsString()
  search: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  cursor?: number;
}
