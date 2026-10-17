import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { FilmService } from './film.service';
import { CreateFilmDto } from './dto/create-film.dto';
import { UpdateFilmDto } from './dto/update-film.dto';
import { FindFilmsDto } from './dto/find-films.dto';
import { Public } from '../../../core/decorator/ispublic.decorator';
import { Roles } from '../../../core/decorator/roles.decorator';
import { USER_ROLE } from '@prisma/client';

@ApiTags('Film')
@Controller({ path: 'film', version: '1' })
export class FilmController {
  constructor(private readonly filmService: FilmService) {}

  @Post()
  @ApiOperation({ summary: 'Create a film' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['film_id', 'imdb_id', 'film_name'],
      properties: {
        film_id: { type: 'number', example: 12345 },
        imdb_id: { type: 'number', example: 67890 },
        film_name: { type: 'string', example: 'Inception' },
        other_titles: { type: 'string', example: '{"vi":"Phim A"}' },
        release_dates: { type: 'array', items: { type: 'object' } },
        age_rating: { type: 'array', items: { type: 'object' } },
        film_trailer: { type: 'string', example: 'https://...' },
        synopsis_long: { type: 'string', example: 'Film synopsis...' },
        images: { type: 'object', additionalProperties: true },
      },
    },
  })
  @Roles(USER_ROLE.ADMIN)
  @ApiCreatedResponse({ description: 'Film created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid film payload' })
  async createFilm(@Body() createFilmDto: CreateFilmDto) {
    return this.filmService.createFilm(createFilmDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a film by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        film_name: { type: 'string', example: 'Inception (Updated)' },
        synopsis_long: { type: 'string', example: 'Updated synopsis...' },
        film_trailer: { type: 'string', example: 'https://...' },
      },
    },
  })
  @Roles(USER_ROLE.ADMIN)
  @ApiOkResponse({ description: 'Film updated successfully' })
  @ApiNotFoundResponse({ description: 'Film not found' })
  @ApiBadRequestResponse({ description: 'Invalid update payload' })
  async updateFilm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateFilmDto: UpdateFilmDto,
  ) {
    return this.filmService.updateFilm(id, updateFilmDto);
  }

  @Roles(USER_ROLE.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a film by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ description: 'Film deleted successfully' })
  @ApiNotFoundResponse({ description: 'Film not found' })
  async deleteFilm(@Param('id', ParseUUIDPipe) id: string) {
    return this.filmService.deleteFilm(id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get film details by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ description: 'Film retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Film not found' })
  async getFilm(@Param('id', ParseUUIDPipe) id: string) {
    return this.filmService.getFilm(id);
  }

  @Public()
  @Post('find')
  @ApiOperation({ summary: 'Find films with pagination and search' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', example: 10 },
        page: { type: 'number', example: 1 },
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
        total: { type: 'number', example: 100 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
        totalPages: { type: 'number', example: 10 },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid find filters' })
  async findFilms(@Body() findFilmsDto: FindFilmsDto) {
    return this.filmService.findFilms(findFilmsDto);
  }
}
