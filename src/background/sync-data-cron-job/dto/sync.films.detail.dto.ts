import type {
  FilmAgeRating,
  FilmAlternateVersion,
  FilmCastMember,
  FilmDirector,
  FilmGenre,
  FilmImages,
  FilmProducer,
  FilmReleaseDate,
  FilmShowDate,
  FilmWriter,
} from '@ticket-order-system/movie-sdk';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SyncFilmItemDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  film_id!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  imdb_id?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(50)
  imdb_title_id?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  film_name?: string;

  @IsOptional()
  @IsObject()
  other_titles?: Record<string, string> | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(50)
  version_type?: string;

  @IsOptional()
  @IsObject()
  images?: FilmImages;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  synopsis_short?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  synopsis_long?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  distributor_id?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  distributor?: string;

  @IsOptional()
  @IsArray()
  release_dates?: FilmReleaseDate[];

  @IsOptional()
  @IsArray()
  age_rating?: FilmAgeRating[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(600)
  duration_mins?: number;

  @IsOptional()
  review_stars?: number | string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  review_txt?: string;

  @IsOptional()
  trailers?: unknown;

  @IsOptional()
  @IsArray()
  genres?: FilmGenre[];

  @IsOptional()
  @IsArray()
  cast?: FilmCastMember[];

  @IsOptional()
  @IsArray()
  directors?: FilmDirector[];

  @IsOptional()
  @IsArray()
  producers?: FilmProducer[];

  @IsOptional()
  @IsArray()
  writers?: FilmWriter[];

  @IsOptional()
  @IsArray()
  show_dates?: FilmShowDate[];

  @IsOptional()
  @IsArray()
  alternate_versions?: FilmAlternateVersion[];

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2048)
  film_trailer?: string | null;
}

export class SyncFilmsDetailDto {
  @IsArray()
  @ArrayMinSize(0)
  film!: SyncFilmItemDto[];
}
