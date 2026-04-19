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
import { SeatService } from './seat.service';
import { CreateSeatDto } from './dto/create-seat.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { FindSeatDto } from './dto/find-seat.dto';
import { Public } from '../../../core/decorator/ispublic.decorator';

@ApiTags('Seat')
@Controller('seat')
export class SeatController {
  constructor(private readonly seatService: SeatService) {}

  @Post()
  @ApiOperation({ summary: 'Create a seat' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['row', 'column', 'filmId', 'cinemaId'],
      properties: {
        row: { type: 'integer', example: 3 },
        column: { type: 'integer', example: 5 },
        status: { type: 'string', example: 'AVAILABLE' },
        filmId: {
          type: 'string',
          example: '0d9dd241-7f36-4518-b628-8b4ec4fd4943',
        },
        cinemaId: { type: 'integer', example: 101 },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Seat created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid seat payload' })
  createSeat(@Body() createSeatDto: CreateSeatDto) {
    return this.seatService.createSeat(createSeatDto);
  }

  @Public()
  @Get('showtime/:filmId/:cinemaId')
  @ApiOperation({ summary: 'Get seats by film and cinema' })
  @ApiParam({
    name: 'filmId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiParam({
    name: 'cinemaId',
    required: true,
    schema: { type: 'integer', example: 101 },
  })
  @ApiOkResponse({ description: 'Seats retrieved successfully' })
  getSeatsByShowtimeId(
    @Param('filmId') filmId: string,
    @Param('cinemaId', ParseIntPipe) cinemaId: number,
  ) {
    return this.seatService.getSeatsByShowtimeId(filmId, cinemaId);
  }

  @Public()
  @Get(':seatId')
  @ApiOperation({ summary: 'Get seat by ID' })
  @ApiParam({
    name: 'seatId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ description: 'Seat retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Seat not found' })
  getSeat(@Param('seatId') seatId: string) {
    return this.seatService.getSeat(seatId);
  }

  @Patch(':seatId')
  @ApiOperation({ summary: 'Update seat by ID' })
  @ApiParam({
    name: 'seatId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        row: { type: 'integer', example: 4 },
        column: { type: 'integer', example: 8 },
        status: { type: 'string', example: 'BOOKED' },
        filmId: {
          type: 'string',
          example: '0d9dd241-7f36-4518-b628-8b4ec4fd4943',
        },
        cinemaId: { type: 'integer', example: 102 },
      },
    },
  })
  @ApiOkResponse({ description: 'Seat updated successfully' })
  @ApiNotFoundResponse({ description: 'Seat not found' })
  @ApiBadRequestResponse({ description: 'Invalid update payload' })
  updateSeat(
    @Param('seatId') seatId: string,
    @Body() updateSeatDto: UpdateSeatDto,
  ) {
    return this.seatService.updateSeat(seatId, updateSeatDto);
  }

  @Delete(':seatId')
  @ApiOperation({ summary: 'Delete seat by ID' })
  @ApiParam({
    name: 'seatId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ description: 'Seat deleted successfully' })
  @ApiNotFoundResponse({ description: 'Seat not found' })
  deleteSeat(@Param('seatId') seatId: string) {
    return this.seatService.deleteSeat(seatId);
  }

  @Public()
  @Post('find')
  @ApiOperation({ summary: 'Find seats with filters and pagination' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        filmId: { type: 'string', format: 'uuid' },
        cinemaId: { type: 'integer', example: 101 },
        status: { type: 'string', example: 'AVAILABLE' },
        limit: { type: 'integer', example: 10 },
        page: { type: 'integer', example: 1 },
        cursor: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Seats fetched successfully',
    schema: {
      type: 'object',
      properties: {
        seats: { type: 'array', items: { type: 'object' } },
        nextCursor: { type: 'string', nullable: true, format: 'uuid' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid find filter payload' })
  findSeats(@Body() findSeatDto: FindSeatDto) {
    return this.seatService.findSeats(findSeatDto);
  }
}
