import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { Public } from '../../../core/decorator/ispublic.decorator';
import { Roles } from '../../../core/decorator/roles.decorator';
import { USER_ROLE } from '@prisma/client';

@ApiTags('Ticket')
@Controller({ path: 'ticket', version: '1' })
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @ApiOperation({ summary: 'Create a ticket' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['price', 'showTimeId', 'seatId'],
      properties: {
        price: { type: 'number', example: 100000 },
        showTimeId: {
          type: 'string',
          format: 'uuid',
          example: '0d9dd241-7f36-4518-b628-8b4ec4fd4943',
        },
        seatId: {
          type: 'string',
          format: 'uuid',
          example: '1e9dd241-7f36-4518-b628-8b4ec4fd4944',
        },
        ticketStatus: { type: 'string', example: 'AVAILABLE' },
      },
    },
  })
  @Roles(USER_ROLE.ADMIN)
  @ApiCreatedResponse({ description: 'Ticket created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid ticket payload' })
  createTicket(@Body() createTicketDto: CreateTicketDto) {
    return this.ticketService.createTicket(createTicketDto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ description: 'Ticket retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Ticket not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketService.getTicketById(id);
  }
}
