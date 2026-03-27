import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
      throw new UnauthorizedException('Email is already in use');
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
    } catch (error) {
      await this.userService.deleteUserByEmail(newUser.email);
      await this.redisService.del(key);
      throw new BadRequestException(`${error}`);
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
      throw new NotFoundException('Email is not registered');
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
      throw new NotFoundException('Email is not registered');
    }

    const resetToken = this.generateCode();
    const key = REDIS_KEY.FORGOT_PASSWORD(email);
    await this.redisService.set(key, resetToken, REDIS_TTL.SHORT_TL);
    this.logger.debug(
      `Generated forgot password token for ${email}: ${resetToken}`,
    );

    try {
      this.emailWorker.sendResetPasswordEmail(email, resetToken);
    } catch (error) {
      await this.redisService.del(key);
      throw new BadRequestException(`${error}`);
    }

    return true;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<boolean> {
    const availableUser = await this.userService.isAvailableEmail(dto.email);
    if (!availableUser) {
      throw new NotFoundException('Email is not registered');
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
    response.cookie('refreshToken', token.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    response.cookie('accessToken', token.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    response.cookie('sessionId', session.id, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });

    return true;
  }

  async refreshToken(req: Request, res: Response) {
    const invalidRefreshTokenError = new UnauthorizedException(
      'Invalid refresh token',
    );

    const sessionId = req.cookies['sessionId'] as string;
    if (!sessionId) {
      throw invalidRefreshTokenError;
    }
    const session = await this.tokenService.getSessionById(sessionId);
    if (!session) {
      throw invalidRefreshTokenError;
    }

    const refreshToken = req.cookies['refreshToken'] as string;
    if (!refreshToken) {
      throw invalidRefreshTokenError;
    }

    const isValidRefreshToken = await this.verifyTextByArgon2(
      session.hashRefreshToken || 'token valid',
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

    res.clearCookie('accessToken', { path: '/' });
    const newAccessToken = await this.tokenService.generateTokens({
      id: payload.id,
      email: payload.email,
    });
    res.clearCookie('refreshToken', { path: '/' });
    const newHashRefreshToken = await this.hashTextByArgon2(
      newAccessToken.refreshToken,
    );
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('accessToken', newAccessToken.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    res.cookie('refreshToken', newAccessToken.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });

    await this.tokenService.updateSession(sessionId, newHashRefreshToken);

    return true;
  }

  async logout(req: Request, res: Response) {
    const sessionId = req.cookies['sessionId'] as string;
    if (!sessionId) {
      throw new NotFoundException('Session ID is missing');
    }

    await this.tokenService.updateSession(sessionId, null);
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('sessionId', { path: '/' });

    return true;
  }
}
