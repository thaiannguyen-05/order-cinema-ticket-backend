import {
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

export type CreateFilmDto = {
  film_id: number;
  film_name: string;
  other_title: OtherTitles;
  release_dates: ReleaseDate[];
  age_rating: AgeRating;
  trailers: Trailers[];
  synopsis_long: string;
  images: FilmImages[];
  version_type: VERSION_TYPE;
  duration_mins: number;
  review_stars: number;
  review_txt?: string;
  distributor?: string;
  genres: Genre[];
  cast: Cast[];
  director: Director[];
  producers: Producer[];
  writers: Writer[];
};
