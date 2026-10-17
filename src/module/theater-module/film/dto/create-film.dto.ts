// Json fields typed as any so Prisma FilmCreateInput accepts direct DTO passthrough.
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFilmDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  film_id!: number;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  imdb_id!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  film_name!: string;

  @IsOptional()
  @IsString()
  other_titles?: string | null;

  @IsOptional()
  @IsArray()
  release_dates?: any;

  @IsOptional()
  @IsArray()
  age_rating?: any;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2048)
  film_trailer?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  synopsis_long?: string;

  @IsOptional()
  @IsObject()
  images?: any;
}
