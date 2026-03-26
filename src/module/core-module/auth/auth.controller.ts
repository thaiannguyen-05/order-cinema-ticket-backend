import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './service/auth.service';
import { RegisterDto } from './dto/register.dto';
import { VreifyEmailDto as VerifyEmailDto } from './dto/verify.dto';
import { ResetPasswordDto } from './dto/reset.password.dto';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { Public } from '../../../core/decorator/ispublic.decorator';
import { Throttle } from '@nestjs/throttler';

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
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('verify-email')
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
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
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
  async forgotPassword(@Body() forgotPasswordBody: { email: string }) {
    return this.authService.forgotPassword(forgotPasswordBody.email);
  }

  @Public()
  @Post('reset-password')
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
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login and issue access/refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'a@gmail.com' },
        password: { type: 'string', example: 'Password@123' },
      },
    },
  })
  @ApiOkResponse({ description: 'Login success' })
  @ApiNotFoundResponse({ description: 'Account is not registered' })
  @ApiUnauthorizedResponse({
    description: 'Account is not active or password is invalid',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() httpRequest: Request,
    @Res({ passthrough: true }) httpResponse: Response,
  ) {
    return this.authService.login(loginDto, httpRequest, httpResponse);
  }

  @Throttle({ debugger: { limit: 5, ttl: 30 } })
  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiCookieAuth('refreshToken')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Token refreshed successfully' })
  @ApiNotFoundResponse({ description: 'Session or refresh token not found' })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  async refreshToken(
    @Req() httpRequest: Request,
    @Res({ passthrough: true }) httpResponse: Response,
  ) {
    return this.authService.refreshToken(httpRequest, httpResponse);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiCookieAuth('refreshToken')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Logout success' })
  @ApiNotFoundResponse({ description: 'Session or refresh token not found' })
  async logout(
    @Req() httpRequest: Request,
    @Res({ passthrough: true }) httpResponse: Response,
  ) {
    return this.authService.logout(httpRequest, httpResponse);
  }
}
