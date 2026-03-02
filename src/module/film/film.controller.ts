import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../core/decorator/ispublic.decorator';
import { FilmService } from './film.service';
import type { CreateFilmDto } from './dto/create-film.dto';
import type { UpdateFilmDto } from './dto/update-film.dto';
import type { FindFilmsDto } from './dto/find-films.dto';

@ApiTags('Film')
@Public()
@Controller('film')
export class FilmController {
  constructor(private readonly filmService: FilmService) {}

  @Post()
  @ApiOperation({ summary: 'Create a film' })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'film_id',
        'film_name',
        'other_title',
        'release_dates',
        'age_rating',
        'trailers',
        'images',
        'version_type',
        'duration_mins',
        'review_stars',
        'genres',
        'cast',
        'director',
        'producers',
        'writers',
      ],
      properties: {
        film_id: { type: 'number', example: 12345 },
        film_name: { type: 'string', example: 'Inception' },
        other_title: { type: 'object', additionalProperties: true },
        release_dates: { type: 'array', items: { type: 'object' } },
        age_rating: { type: 'object', additionalProperties: true },
        trailers: { type: 'array', items: { type: 'object' } },
        synopsis_long: { type: 'string', example: 'Film synopsis...' },
        images: { type: 'array', items: { type: 'object' } },
        version_type: { type: 'string', example: 'STANDARD' },
        duration_mins: { type: 'number', example: 148 },
        review_stars: { type: 'number', example: 4.7 },
        review_txt: { type: 'string', example: 'Great movie' },
        distributor: { type: 'string', example: 'Warner Bros' },
        genres: { type: 'array', items: { type: 'object' } },
        cast: { type: 'array', items: { type: 'object' } },
        director: { type: 'array', items: { type: 'object' } },
        producers: { type: 'array', items: { type: 'object' } },
        writers: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Film created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid film payload' })
  async createFilm(@Body() createFilmDto: CreateFilmDto) {
    return this.filmService.createFilm(createFilmDto);
  }

  @Patch(':film_id')
  @ApiOperation({ summary: 'Update a film by ID' })
  @ApiParam({
    name: 'film_id',
    required: true,
    schema: { type: 'integer', example: 12345 },
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        film_name: { type: 'string', example: 'Inception (Updated)' },
        synopsis_long: { type: 'string', example: 'Updated synopsis...' },
        review_stars: { type: 'number', example: 4.9 },
      },
    },
  })
  @ApiOkResponse({ description: 'Film updated successfully' })
  @ApiNotFoundResponse({ description: 'Film not found' })
  @ApiBadRequestResponse({ description: 'Invalid update payload' })
  async updateFilm(
    @Param('film_id', ParseIntPipe) filmId: number,
    @Body() updateFilmDto: UpdateFilmDto,
  ) {
    return this.filmService.updateFilm(filmId, updateFilmDto);
  }

  @Delete(':film_id')
  @ApiOperation({ summary: 'Delete a film by ID' })
  @ApiParam({
    name: 'film_id',
    required: true,
    schema: { type: 'integer', example: 12345 },
  })
  @ApiOkResponse({ description: 'Film deleted successfully' })
  @ApiNotFoundResponse({ description: 'Film not found' })
  async deleteFilm(@Param('film_id', ParseIntPipe) filmId: number) {
    return this.filmService.deleteFilm(filmId);
  }

  @Get(':film_id')
  @ApiOperation({ summary: 'Get film details by ID' })
  @ApiParam({
    name: 'film_id',
    required: true,
    schema: { type: 'integer', example: 12345 },
  })
  @ApiOkResponse({ description: 'Film retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Film not found' })
  async getFilm(@Param('film_id', ParseIntPipe) filmId: number) {
    return this.filmService.getFilm(filmId);
  }

  @Post('find')
  @ApiOperation({ summary: 'Find films with pagination and search' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', example: 10 },
        page: { type: 'number', example: 1 },
        cursor: { type: 'number', example: 12345 },
        search: { type: 'string', example: 'inception' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Films list returned successfully',
    schema: {
      type: 'object',
      properties: {
        films: { type: 'array', items: { type: 'object' } },
        nextCursor: { type: 'number', nullable: true, example: 12399 },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid find filters' })
  async findFilms(@Body() findFilmsDto: FindFilmsDto) {
    return this.filmService.findFilms(findFilmsDto);
  }
}
