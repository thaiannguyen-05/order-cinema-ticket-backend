import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from 'argon2';
import { UserService } from '../../user/user.service';
import { RegisterDto } from '../dto/register.dto';
import { VerifyEmailDto } from '../dto/verify.dto';
import { ResetPasswordDto } from '../dto/reset.password.dto';
import { LoginDto } from '../dto/login.dto';
import { TokenService } from './token.service';
import type { Request, Response } from 'express';
import { EmailWorker } from '../../../../background/email/email.worker';
import { RedisService } from '../../../../background/redis/redis.service';
import { REDIS_KEY, REDIS_TTL } from '../../../../background/redis/redis.value';
import { MyLogger } from '../../../../core/logger/logger.service';
import { Payload } from '../../../../core';
import { UserWithoutPassword } from '../type/type';
import {
  AUTH_COOKIE_NAME,
  clearAuthCookies,
  getAuthCookieOptions,
  setAuthCookies,
} from '../type/constant';
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly emailWorker: EmailWorker,
    private readonly redisService: RedisService,
    private readonly logger: MyLogger,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
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

  private getUserIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    const realIp = request.headers['x-real-ip'];

    const candidate =
      (typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]
        : Array.isArray(forwardedFor)
          ? forwardedFor[0]
          : undefined) ??
      (typeof realIp === 'string' ? realIp : undefined) ??
      request.ip ??
      request.socket.remoteAddress ??
      'unknown';

    return candidate.trim().replace(/^::ffff:/, '');
  }

  async register(dto: RegisterDto): Promise<UserWithoutPassword> {
    const availableUser = await this.userService.isAvailableEmail(dto.email);
    if (availableUser) {
      throw new ConflictException('Email is already in use');
    }

    const hashedPassword = await this.hashTextByArgon2(dto.password);

    const verificationCode = this.generateCode();
    const key = REDIS_KEY.REGISTER_USER(dto.email);
    await this.redisService.set(key, verificationCode, REDIS_TTL.SHORT_TL);

    const newUser = await this.userService.createUser({
      fullname: dto.fullname,
      email: dto.email,
      password: hashedPassword,
      address: dto.address,
      dateOfBirth: dto.dateOfBirth,
    });

    try {
      this.emailWorker.sendVerifyCode(dto.email, verificationCode);
    } catch {
      await this.userService.deleteUserByEmail(newUser.email);
      await this.redisService.del(key);
      throw new ServiceUnavailableException(
        'Email service is temporarily unavailable',
      );
    }

    const result: UserWithoutPassword = {
      id: newUser.id,
      fullname: newUser.fullname,
      email: newUser.email,
      address: newUser.address,
      dateOfBirth: newUser.dateOfBirth,
    };

    return result;
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<boolean> {
    const availableUser = await this.userService.isAvailableEmail(dto.email);
    this.logger.debug(`${availableUser}`);
    if (!availableUser) {
      return true;
    }

    const key = REDIS_KEY.REGISTER_USER(dto.email);
    const storedCode = await this.redisService.get(key);
    if (!storedCode) {
      throw new BadRequestException('Verification code has expired');
    }
    if (storedCode !== dto.code) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.userService.updateUserByEmail({
      email: dto.email,
      status: 'ACTIVE',
    });

    await this.redisService.del(key);
    this.logger.debug(`Deleted verification code for ${dto.email} from Redis`);

    return true;
  }

  async forgotPassword(email: string) {
    const availableUser = await this.userService.isAvailableEmail(email);
    if (!availableUser) {
      return true;
    }

    const resetToken = this.generateCode();
    const key = REDIS_KEY.FORGOT_PASSWORD(email);
    await this.redisService.set(key, resetToken, REDIS_TTL.SHORT_TL);
    try {
      this.emailWorker.sendResetPasswordEmail(email, resetToken);
    } catch {
      await this.redisService.del(key);
      throw new ServiceUnavailableException(
        'Email service is temporarily unavailable',
      );
    }

    return true;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<boolean> {
    const availableUser = await this.userService.isAvailableEmail(dto.email);
    if (!availableUser) {
      return true;
    }

    const key = REDIS_KEY.FORGOT_PASSWORD(dto.email);
    const storedToken = await this.redisService.get(key);
    if (!storedToken) {
      throw new BadRequestException('Reset token has expired');
    }
    if (storedToken !== dto.code) {
      throw new BadRequestException('Invalid reset token');
    }

    const hashedPassword = await this.hashTextByArgon2(dto.newPassword);
    await this.userService.updateUserByEmail({
      email: dto.email,
      password: hashedPassword,
    });

    await this.redisService.del(key);
    this.logger.debug(
      `Deleted forgot password token for ${dto.email} from Redis`,
    );

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

    await this.tokenService.updateSession(sessionId, null);
    clearAuthCookies(res);

    return true;
  }
}
