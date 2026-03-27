import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
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
import { VerifyEmailDto } from './dto/verify.dto';
import { ResetPasswordDto } from './dto/reset.password.dto';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { Public } from '../../../core/decorator/ispublic.decorator';
import { Throttle } from '@nestjs/throttler';
import { ForgotPasswordDto } from './dto/forgot.password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user and send verification code' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'Register success. User is created with pending status.',
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with 6-digit code' })
  @ApiBody({ type: VerifyEmailDto })
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset and send reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({
    description: 'Forgot password email sent successfully',
  })
  @ApiNotFoundResponse({ description: 'Email is not registered' })
  @ApiBadRequestResponse({
    description: 'Cannot send reset password email',
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiBody({ type: ResetPasswordDto })
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and issue access/refresh token' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Login success' })
  @ApiUnauthorizedResponse({
    description: 'Account is not active or credentials are invalid',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() httpRequest: Request,
    @Res({ passthrough: true }) httpResponse: Response,
  ) {
    return this.authService.login(loginDto, httpRequest, httpResponse);
  }

  @Public()
  @Throttle({ refreshToken: { limit: 5, ttl: 30 } })
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookies' })
  @ApiCookieAuth('refreshToken')
  @ApiCookieAuth('sessionId')
  @ApiOkResponse({ description: 'Token refreshed successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  async refreshToken(
    @Req() httpRequest: Request,
    @Res({ passthrough: true }) httpResponse: Response,
  ) {
    return this.authService.refreshToken(httpRequest, httpResponse);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('sessionId')
  @ApiOkResponse({ description: 'Logout success' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Session not found' })
  async logout(
    @Req() httpRequest: Request,
    @Res({ passthrough: true }) httpResponse: Response,
  ) {
    return this.authService.logout(httpRequest, httpResponse);
  }
}
