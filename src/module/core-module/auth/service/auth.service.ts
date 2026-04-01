import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from 'argon2';
import type { Request, Response } from 'express';
import { EVENT_NAME } from '../../../../background/email/constant/event.type';
import { EmailWorker } from '../../../../background/email/email.worker';
import { OutboxService } from '../../../../background/email/outbox.service';
import { Payload } from '../../../../core';
import { MyLogger } from '../../../../core/logger/logger.service';
import { UserService } from '../../user/user.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResetPasswordDto } from '../dto/reset.password.dto';
import { VerifyEmailDto } from '../dto/verify.dto';
import {
  AUTH_COOKIE_NAME,
  clearAuthCookies,
  getAuthCookieOptions,
  setAuthCookies,
} from '../type/constant';
import { UserWithoutPassword } from '../type/type';
import { TokenService } from './token.service';
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly emailWorker: EmailWorker,
    private readonly logger: MyLogger,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly outboxService: OutboxService,
  ) {}

  private hashTextByArgon2(password: string): Promise<string> {
    return hash(password);
  }

  private verifyTextByArgon2(hash: string, text: string) {
    return verify(hash, text);
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // private getUserIp(request: Request): string {
  //   const forwardedFor = request.headers['x-forwarded-for'];
  //   const realIp = request.headers['x-real-ip'];

  //   const candidate =
  //     (typeof forwardedFor === 'string'
  //       ? forwardedFor.split(',')[0]
  //       : Array.isArray(forwardedFor)
  //         ? forwardedFor[0]
  //         : undefined) ??
  //     (typeof realIp === 'string' ? realIp : undefined) ??
  //     request.ip ??
  //     request.socket.remoteAddress ??
  //     'unknown';

  //   return candidate.trim().replace(/^::ffff:/, '');
  // }

  async register(dto: RegisterDto) {
    const availableUser = await this.userService.isAvailableEmail(dto.email);
    if (availableUser) {
      throw new ConflictException('Email is already in use');
    }

    const hashedPassword = await this.hashTextByArgon2(dto.password);
    const verificationCode = this.generateCode();
    const payload = {
      email: dto.email,
      code: verificationCode,
    };
    const outbox = await this.outboxService.createOutboxMessage(
      EVENT_NAME.SEND_VERIFY_CODE,
      payload,
    );

    const newUser = await this.userService.createUser({
      fullname: dto.fullname,
      email: dto.email,
      password: hashedPassword,
      address: dto.address,
      dateOfBirth: dto.dateOfBirth,
    });

    this.emailWorker.sendVerifyCode(dto.email, verificationCode);

    const result: UserWithoutPassword = {
      id: newUser.id,
      fullname: newUser.fullname,
      email: newUser.email,
      address: newUser.address,
      dateOfBirth: newUser.dateOfBirth,
    };

    return {
      outbox,
      result,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<boolean> {
    const availableUser = await this.userService.isAvailableEmail(dto.email);
    this.logger.debug(`${availableUser}`);
    if (!availableUser) {
      return true;
    }

    const outBox = await this.outboxService.getOutBox(dto.outBoxId);
    if (!outBox) {
      throw new NotFoundException('Code is expired or system has some errors');
    }
    if (outBox.eventType !== EVENT_NAME.SEND_VERIFY_CODE) {
      throw new BadRequestException('Invalid verification request');
    }

    const payload = outBox.payload as { email?: string; code?: string };
    const storedCode = payload.code;
    if (!storedCode) {
      throw new BadRequestException('Verification code is invalid');
    }
    if (storedCode !== dto.code) {
      throw new BadRequestException('Invalid verification code');
    }
    if (payload.email !== dto.email) {
      throw new BadRequestException('Invalid verification code');
    }

    await Promise.all([
      this.userService.updateUserByEmail({
        email: dto.email,
        status: 'ACTIVE',
      }),
      this.outboxService.updateOutboxMessage(outBox.id, 'PROCESSED'),
    ]);

    return true;
  }

  async forgotPassword(email: string) {
    const availableUser = await this.userService.isAvailableEmail(email);
    if (!availableUser) {
      throw new NotFoundException('User not found');
    }

    const resetToken = this.generateCode();
    const outbox = await this.outboxService.createOutboxMessage(
      EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL,
      { email: email, code: resetToken },
    );

    try {
      this.emailWorker.sendResetPasswordEmail(email, resetToken);
    } catch {
      throw new ServiceUnavailableException(
        'Email service is temporarily unavailable',
      );
    }

    return outbox;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<boolean> {
    const availableUser = await this.userService.isAvailableEmail(dto.email);
    if (!availableUser) {
      return true;
    }

    const outBox = await this.outboxService.getOutBox(dto.outBoxId);
    if (!outBox) {
      throw new NotFoundException('Code is expired or system has some errors');
    }
    if (outBox.eventType !== EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL) {
      throw new BadRequestException('Invalid reset password request');
    }

    const payload = outBox.payload as { email?: string; code?: string };
    const storedCode = payload.code;
    if (!storedCode) {
      throw new BadRequestException('Verification code is invalid');
    }
    if (storedCode !== dto.code) {
      throw new BadRequestException('Invalid verification code');
    }
    if (payload.email !== dto.email) {
      throw new BadRequestException('Invalid verification code');
    }

    const hashedPassword = await this.hashTextByArgon2(dto.newPassword);

    await Promise.all([
      this.userService.updateUserByEmail({
        email: dto.email,
        password: hashedPassword,
      }),
      this.outboxService.updateOutboxMessage(dto.outBoxId, 'PROCESSED'),
    ]);

    return true;
  }

  async login(dto: LoginDto, request: Request, response: Response) {
    const availableUser = await this.userService.getUserByEmail(dto.email);
    const invalidCredentialsError = new UnauthorizedException(
      'Invalid email or password',
    );

    if (!availableUser) {
      throw invalidCredentialsError;
    }

    if (availableUser.status !== 'ACTIVE') {
      throw invalidCredentialsError;
    }

    const isValidPassword = await this.verifyTextByArgon2(
      availableUser.hashPassword,
      dto.password,
    );
    if (!isValidPassword) {
      throw invalidCredentialsError;
    }

    const token = await this.tokenService.generateTokens(availableUser);
    const hashRefreshToken = await this.hashTextByArgon2(token.refreshToken);
    const session = await this.tokenService.handleSession(
      availableUser.id,
      hashRefreshToken,
    );
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    setAuthCookies(
      response,
      {
        refreshToken: token.refreshToken,
        accessToken: token.accessToken,
        sessionId: session.id,
      },
      isProduction,
    );

    return true;
  }

  async refreshToken(req: Request, res: Response) {
    const invalidRefreshTokenError = new UnauthorizedException(
      'Invalid refresh token',
    );

    const sessionId = req.cookies[AUTH_COOKIE_NAME.SESSION_ID] as string;
    if (!sessionId) {
      throw invalidRefreshTokenError;
    }
    const session = await this.tokenService.getSessionById(sessionId);
    if (!session) {
      throw invalidRefreshTokenError;
    }

    const refreshToken = req.cookies[AUTH_COOKIE_NAME.REFRESH_TOKEN] as string;
    if (!refreshToken) {
      throw invalidRefreshTokenError;
    }

    const isValidRefreshToken = await this.verifyTextByArgon2(
      session.hashRefreshToken,
      refreshToken,
    );
    if (!isValidRefreshToken) {
      throw invalidRefreshTokenError;
    }

    const payload: Payload = await this.tokenService.verifyToken(refreshToken);
    if (payload.id !== session.userId) {
      throw invalidRefreshTokenError;
    }

    const availableUser = await this.userService.getUserById(payload.id);
    if (!availableUser) {
      throw invalidRefreshTokenError;
    }

    res.clearCookie(AUTH_COOKIE_NAME.ACCESS_TOKEN, { path: '/' });
    const newAccessToken = await this.tokenService.generateTokens({
      id: payload.id,
      email: payload.email,
    });
    res.clearCookie(AUTH_COOKIE_NAME.REFRESH_TOKEN, { path: '/' });
    const newHashRefreshToken = await this.hashTextByArgon2(
      newAccessToken.refreshToken,
    );
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const cookieOptions = getAuthCookieOptions(isProduction);
    res.cookie(
      AUTH_COOKIE_NAME.ACCESS_TOKEN,
      newAccessToken.accessToken,
      cookieOptions,
    );
    res.cookie(
      AUTH_COOKIE_NAME.REFRESH_TOKEN,
      newAccessToken.refreshToken,
      cookieOptions,
    );

    await this.tokenService.updateSession(sessionId, newHashRefreshToken);

    return true;
  }

  async logout(req: Request, res: Response) {
    const sessionId = req.cookies[AUTH_COOKIE_NAME.SESSION_ID] as string;
    if (!sessionId) {
      throw new UnauthorizedException('Session ID is missing');
    }

    await this.tokenService.deleteSession(sessionId);
    clearAuthCookies(res);

    return true;
  }
}
