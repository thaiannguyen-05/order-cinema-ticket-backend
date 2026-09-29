import type {
  AgeRating,
  Cast,
  Director,
  FilmImages,
  Genre,
  OtherTitles,
  Producer,
  ReleaseDate,
  Trailers,
  Writer,
} from '@andev2005/movie-glu-sdk';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { VERSION_TYPE } from '@prisma/client';

export class ReleaseDateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  release_date?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class AgeRatingDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  rating?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  age_rating_image?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  age_advisory?: string;
}

export class GenreDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  genre_id!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  genre_name!: string;
}

export class CastDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  cast_id!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cast_name!: string;
}

export class DirectorDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  director_id!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  director_name!: string;
}

export class ProducerDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  producer_id!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  producer_name!: string;
}

export class WriterDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  writer_id!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  writer_name!: string;
}

export class CreateFilmDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  film_id!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  film_name!: string;

  @IsObject()
  @IsNotEmpty()
  other_title!: OtherTitles;

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => ReleaseDateDto)
  release_dates!: ReleaseDate[];

  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AgeRatingDto)
  age_rating!: AgeRating;

  @IsArray()
  @ArrayMinSize(0)
  trailers!: Trailers[];

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  synopsis_long!: string;

  @IsArray()
  @ArrayMinSize(0)
  images!: FilmImages[];

  @IsEnum(VERSION_TYPE)
  @IsNotEmpty()
  version_type!: VERSION_TYPE;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(600)
  duration_mins!: number;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(5)
  review_stars!: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  review_txt?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  distributor?: string;

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => GenreDto)
  genres!: Genre[];

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CastDto)
  cast!: Cast[];

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => DirectorDto)
  director!: Director[];

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => ProducerDto)
  producers!: Producer[];

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => WriterDto)
  writers!: Writer[];
}
