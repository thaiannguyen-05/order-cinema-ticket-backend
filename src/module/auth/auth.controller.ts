import { Body, Controller, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';
import { Public } from '../../core/decorator/ispublic.decorator';
import type { VreifyEmailDto } from './dto/verify.dto';
import type { ResetPasswordDto } from './dto/reset.password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user and send verification code' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fullname', 'email', 'password', 'dateOfBirth', 'address'],
      properties: {
        fullname: { type: 'string', example: 'Nguyen Van A' },
        email: { type: 'string', format: 'email', example: 'a@gmail.com' },
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
  @ApiCreatedResponse({
    description: 'Register success. User is created with pending status.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        fullname: { type: 'string' },
        email: { type: 'string', format: 'email' },
        address: { type: 'string' },
        dateOfBirth: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Email is already in use' })
  @ApiBadRequestResponse({
    description: 'Cannot send verification email or invalid request data',
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Patch('verify-email')
  @ApiOperation({ summary: 'Verify email with 6-digit code' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'code'],
      properties: {
        email: { type: 'string', format: 'email', example: 'a@gmail.com' },
        code: {
          type: 'string',
          description: '6-digit verification code',
          example: '123456',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Verify success',
    schema: { type: 'boolean', example: true },
  })
  @ApiNotFoundResponse({ description: 'Email is not registered' })
  @ApiBadRequestResponse({
    description: 'Verification code expired or invalid',
  })
  async verifyEmail(@Body() dto: VreifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset and send reset email' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email', example: 'a@gmail.com' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Forgot password email sent successfully',
  })
  @ApiNotFoundResponse({ description: 'Email is not registered' })
  @ApiBadRequestResponse({
    description: 'Cannot send reset password email',
  })
  async forgotPassword(@Body() dto: { email: string }) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Patch('reset-password')
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'code', 'newPassword'],
      properties: {
        email: { type: 'string', format: 'email', example: 'a@gmail.com' },
        code: { type: 'string', example: '123456' },
        newPassword: { type: 'string', example: 'NewPassword@123' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Reset password success',
  })
  @ApiNotFoundResponse({ description: 'Email is not registered' })
  @ApiBadRequestResponse({
    description: 'Invalid reset token or password does not meet requirements',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
