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
import { VERSION_TYPE } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateFilmDto {
  @IsNumber()
  film_id: number;

  @IsString()
  film_name: string;

  @IsObject()
  other_title: OtherTitles;

  @IsArray()
  release_dates: ReleaseDate[];

  @IsObject()
  age_rating: AgeRating;

  @IsArray()
  trailers: Trailers[];

  @IsString()
  synopsis_long: string;

  @IsArray()
  images: FilmImages[];

  @IsEnum(VERSION_TYPE)
  version_type: VERSION_TYPE;

  @IsNumber()
  duration_mins: number;

  @IsNumber()
  review_stars: number;

  @IsOptional()
  @IsString()
  review_txt?: string;

  @IsOptional()
  @IsString()
  distributor?: string;

  @IsArray()
  genres: Genre[];

  @IsArray()
  cast: Cast[];

  @IsArray()
  director: Director[];

  @IsArray()
  producers: Producer[];

  @IsArray()
  writers: Writer[];
}
