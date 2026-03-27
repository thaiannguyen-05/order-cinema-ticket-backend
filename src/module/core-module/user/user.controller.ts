import { Body, Controller, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { UpdateUser } from './dto/update.user.dto';
import { UserService } from './user.service';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('User')
@ApiBearerAuth('bearerAuth')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('update')
  @ApiOperation({ summary: 'Update current user profile by access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullname: { type: 'string', example: 'Nguyen Van A' },
        password: { type: 'string', example: 'Password@123' },
        dateOfBirth: {
          type: 'string',
          format: 'date-time',
          example: '2000-01-01T00:00:00.000Z',
        },
        address: { type: 'string', example: 'Ho Chi Minh City' },
      },
    },
  })
  @ApiOkResponse({ description: 'User updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid update payload' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async updateUser(@Req() req: Request, @Body() dto: UpdateUser) {
    const email = req.payload?.email;
    dto.email = email!;
    return this.userService.updateUserByEmail(dto);
  }
}
