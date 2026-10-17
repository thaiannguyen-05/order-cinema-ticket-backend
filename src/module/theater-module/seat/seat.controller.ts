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
import { SeatService } from './seat.service';
import { CreateSeatDto } from './dto/create-seat.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { FindSeatDto } from './dto/find-seat.dto';
import { Public } from '../../../core/decorator/ispublic.decorator';
import { Roles } from '../../../core/decorator/roles.decorator';
import { USER_ROLE } from '@prisma/client';

@ApiTags('Seat')
@Controller({ path: 'seat', version: '1' })
export class SeatController {
  constructor(private readonly seatService: SeatService) {}

  @Post()
  @ApiOperation({ summary: 'Create a seat' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['row', 'column', 'seatType'],
      properties: {
        row: { type: 'string', example: 'A' },
        column: { type: 'string', example: '12' },
        seatType: { type: 'string', example: 'NORMAL' },
        seatStatus: { type: 'string', example: 'AVAILABLE' },
        roomId: {
          type: 'string',
          format: 'uuid',
          example: '0d9dd241-7f36-4518-b628-8b4ec4fd4943',
        },
      },
    },
  })
  @Roles(USER_ROLE.ADMIN)
  @ApiCreatedResponse({ description: 'Seat created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid seat payload' })
  createSeat(@Body() createSeatDto: CreateSeatDto) {
    return this.seatService.createSeat(createSeatDto);
  }

  @Public()
  @Get('room/:roomId')
  @ApiOperation({ summary: 'Get seats by room' })
  @ApiParam({
    name: 'roomId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ description: 'Seats retrieved successfully' })
  getSeatsByRoomId(@Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.seatService.getSeatsByRoomId(roomId);
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
  getSeat(@Param('seatId', ParseUUIDPipe) seatId: string) {
    return this.seatService.getSeat(seatId);
  }

  @Roles(USER_ROLE.ADMIN)
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
        row: { type: 'string', example: 'B' },
        column: { type: 'string', example: '8' },
        seatType: { type: 'string', example: 'COUPLE' },
        seatStatus: { type: 'string', example: 'NOT_AVAILABLE' },
        roomId: {
          type: 'string',
          format: 'uuid',
          example: '0d9dd241-7f36-4518-b628-8b4ec4fd4943',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Seat updated successfully' })
  @ApiNotFoundResponse({ description: 'Seat not found' })
  @ApiBadRequestResponse({ description: 'Invalid update payload' })
  updateSeat(
    @Param('seatId', ParseUUIDPipe) seatId: string,
    @Body() updateSeatDto: UpdateSeatDto,
  ) {
    return this.seatService.updateSeat(seatId, updateSeatDto);
  }

  @Roles(USER_ROLE.ADMIN)
  @Delete(':seatId')
  @ApiOperation({ summary: 'Delete seat by ID' })
  @ApiParam({
    name: 'seatId',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ description: 'Seat deleted successfully' })
  @ApiNotFoundResponse({ description: 'Seat not found' })
  deleteSeat(@Param('seatId', ParseUUIDPipe) seatId: string) {
    return this.seatService.deleteSeat(seatId);
  }

  @Public()
  @Post('find')
  @ApiOperation({ summary: 'Find seats with filters and pagination' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        roomId: { type: 'string', format: 'uuid' },
        seatType: { type: 'string', example: 'NORMAL' },
        seatStatus: { type: 'string', example: 'AVAILABLE' },
        limit: { type: 'integer', example: 10 },
        page: { type: 'integer', example: 1 },
      },
    },
  })
  @ApiOkResponse({
    description: 'Seats fetched successfully',
    schema: {
      type: 'object',
      properties: {
        seats: { type: 'array', items: { type: 'object' } },
        total: { type: 'number', example: 100 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
        totalPages: { type: 'number', example: 10 },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid find filter payload' })
  findSeats(@Body() findSeatDto: FindSeatDto) {
    return this.seatService.findSeats(findSeatDto);
  }
}
