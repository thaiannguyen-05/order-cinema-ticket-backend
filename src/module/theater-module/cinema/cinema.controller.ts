import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
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
import { USER_ROLE } from '@prisma/client';
import { CinemaService } from './cinema.service';
import { CreateCinemaDto } from './dto/create-cinema.dto';
import { FindCinemaDto } from './dto/find-cinema.dto';
import { UpdateCinemaDto } from './dto/update-cinema.dto';
import { Public } from '../../../core/decorator/ispublic.decorator';
import { Roles } from '../../../core/decorator/roles.decorator';

@ApiTags('Cinema')
@Controller('cinema')
export class CinemaController {
  constructor(private readonly cinemaService: CinemaService) {}

  @Public()
  @Get(':cinema_id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @ApiOperation({ summary: 'Get cinema by ID' })
  @ApiParam({
    name: 'cinema_id',
    required: true,
    schema: { type: 'integer', example: 101 },
  })
  @ApiOkResponse({ description: 'Cinema retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Cinema not found' })
  getCinema(@Param('cinema_id', ParseIntPipe) cinemaId: number) {
    return this.cinemaService.getCinema(cinemaId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a cinema' })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'cinema_id',
        'cinema_name',
        'address',
        'city',
        'postcode',
        'logo_url',
      ],
      properties: {
        cinema_id: { type: 'integer', example: 101 },
        cinema_name: { type: 'string', example: 'CGV Vincom Center' },
        address: { type: 'string', example: '123 Le Loi St' },
        address2: { type: 'string', example: 'Ward 1' },
        city: { type: 'string', example: 'Ho Chi Minh City' },
        country: { type: 'string', example: 'Vietnam' },
        postcode: { type: 'string', example: '700000' },
        phone: { type: 'string', example: '+84-28-1234-5678' },
        logo_url: {
          type: 'string',
          example: 'https://example.com/cinema-logo.png',
        },
      },
    },
  })
  @Roles(USER_ROLE.ADMIN)
  @ApiCreatedResponse({ description: 'Cinema created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid cinema payload' })
  createCinema(@Body() createCinemaDto: CreateCinemaDto) {
    return this.cinemaService.createCinema(createCinemaDto);
  }

  @Patch(':cinema_id')
  @ApiOperation({ summary: 'Update cinema by ID' })
  @ApiParam({
    name: 'cinema_id',
    required: true,
    schema: { type: 'integer', example: 101 },
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        cinema_name: { type: 'string', example: 'CGV Landmark 81' },
        address: { type: 'string', example: '720A Dien Bien Phu' },
        address2: { type: 'string', example: 'Binh Thanh District' },
        city: { type: 'string', example: 'Ho Chi Minh City' },
        country: { type: 'string', example: 'Vietnam' },
        postcode: { type: 'string', example: '700000' },
        phone: { type: 'string', example: '+84-28-9876-5432' },
        logo_url: {
          type: 'string',
          example: 'https://example.com/new-cinema-logo.png',
        },
      },
    },
  })
  @Roles(USER_ROLE.ADMIN)
  @ApiOkResponse({ description: 'Cinema updated successfully' })
  @ApiNotFoundResponse({ description: 'Cinema not found' })
  @ApiBadRequestResponse({ description: 'Invalid update payload' })
  updateCinema(
    @Body() updateCinemaDto: UpdateCinemaDto,
    @Param('cinema_id', ParseIntPipe) cinemaId: number,
  ) {
    return this.cinemaService.updateCinema(updateCinemaDto, cinemaId);
  }

  @Roles(USER_ROLE.ADMIN)
  @Delete(':cinema_id')
  @ApiOperation({ summary: 'Delete cinema by ID' })
  @ApiParam({
    name: 'cinema_id',
    required: true,
    schema: { type: 'integer', example: 101 },
  })
  @ApiOkResponse({ description: 'Cinema deleted successfully' })
  @ApiNotFoundResponse({ description: 'Cinema not found' })
  deleteCinema(@Param('cinema_id', ParseIntPipe) cinemaId: number) {
    return this.cinemaService.deleteCinema(cinemaId);
  }

  @Public()
  @Post('find')
  @ApiOperation({ summary: 'Find cinemas with search and pagination' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['search'],
      properties: {
        search: { type: 'string', example: 'cgv' },
        limit: { type: 'integer', example: 10 },
        page: { type: 'integer', example: 1 },
        cursor: { type: 'integer', example: 120 },
      },
    },
  })
  @ApiOkResponse({
    description: 'Cinemas fetched successfully',
    schema: {
      type: 'object',
      properties: {
        cinemas: { type: 'array', items: { type: 'object' } },
        nextCursor: { type: 'integer', nullable: true, example: 145 },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid find filter payload' })
  findCinemas(@Body() findCinemaDto: FindCinemaDto) {
    return this.cinemaService.findCinemas(findCinemaDto);
  }
}
