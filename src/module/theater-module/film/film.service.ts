import { Injectable } from '@nestjs/common';
import { CreateFilmDto } from './dto/create-film.dto';
import { FindFilmsDto } from './dto/find-films.dto';
import { PrismaService } from '../../../background/prisma/prisma.service';

@Injectable()
export class FilmService {
  constructor(private readonly prismaService: PrismaService) {}

  async createFilm(data: CreateFilmDto) {
    return await this.prismaService.film.create({
      data: {
        film_id: data.film_id,
        film_name: data.film_name,
        other_title: JSON.stringify(data.other_title),
        release_dates: JSON.stringify(data.release_dates),
        age_rating: JSON.stringify(data.age_rating),
        trailers: JSON.stringify(data.trailers),
        synopsis_long: data.synopsis_long,
        images: JSON.stringify(data.images),
        version_type: data.version_type,
        duration_mins: data.duration_mins,
        review_stars: data.review_stars,
        review_txt: data.review_txt,
        distributor: data.distributor,
        genres: JSON.stringify(data.genres),
        cast: JSON.stringify(data.cast),
        directors: JSON.stringify(data.director),
        producers: JSON.stringify(data.producers),
        writers: JSON.stringify(data.writers),
      },
    });
  }

  async updateFilm(film_id: number, data: Partial<CreateFilmDto>) {
    return await this.prismaService.film.update({
      where: { film_id },
      data: {
        film_name: data.film_name,
        other_title: data.other_title
          ? JSON.stringify(data.other_title)
          : undefined,
        release_dates: data.release_dates
          ? JSON.stringify(data.release_dates)
          : undefined,
        age_rating: data.age_rating
          ? JSON.stringify(data.age_rating)
          : undefined,
        trailers: data.trailers ? JSON.stringify(data.trailers) : undefined,
        synopsis_long: data.synopsis_long,
        images: data.images ? JSON.stringify(data.images) : undefined,
        version_type: data.version_type,
        duration_mins: data.duration_mins,
        review_stars: data.review_stars,
        review_txt: data.review_txt,
        distributor: data.distributor,
        genres: data.genres ? JSON.stringify(data.genres) : undefined,
        cast: data.cast ? JSON.stringify(data.cast) : undefined,
        directors: data.director ? JSON.stringify(data.director) : undefined,
        producers: data.producers ? JSON.stringify(data.producers) : undefined,
        writers: data.writers ? JSON.stringify(data.writers) : undefined,
      },
    });
  }

  async getAllFilms() {
    return await this.prismaService.film.findMany();
  }

  async deleteFilm(film_id: number) {
    return await this.prismaService.film.delete({
      where: { film_id },
    });
  }

  async getFilm(film_id: number) {
    return await this.prismaService.film.findUnique({
      where: { film_id },
    });
  }

  async findFilms(dto: FindFilmsDto) {
    if (!dto.limit) dto.limit = 10;
    if (!dto.page) dto.page = 1;

    if (dto.cursor) {
      const films = await this.prismaService.film.findMany({
        where: {
          film_name: {
            contains: dto.search || '',
            mode: 'insensitive',
          },
        },
        take: dto.limit,
        skip: 1,
        cursor: {
          film_id: dto.cursor,
        },
      });

      const hasNextPage = films.length > dto.limit;
      const nextCursor = hasNextPage ? films[films.length - 1].film_id : null;

      return {
        films: hasNextPage ? films.slice(0, -1) : films,
        nextCursor,
      };
    }

    const films = await this.prismaService.film.findMany({
      where: {
        film_name: {
          contains: dto.search || '',
          mode: 'insensitive',
        },
      },
      take: dto.limit,
      skip: (dto.page - 1) * dto.limit,
    });

    const hasNextPage = films.length > dto.limit;
    const nextCursor = hasNextPage ? films[films.length - 1].film_id : null;

    return {
      films: hasNextPage ? films.slice(0, -1) : films,
      nextCursor,
    };
  }
}
