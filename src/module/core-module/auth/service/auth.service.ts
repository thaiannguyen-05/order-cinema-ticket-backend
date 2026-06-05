import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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

    let newUser;
    try {
      newUser = await this.userService.createUser({
        fullname: dto.fullname,
        email: dto.email,
        password: hashedPassword,
        address: dto.address,
        dateOfBirth: dto.dateOfBirth,
      });
    } catch (error: unknown) {
      // Handle Prisma unique constraint error (P2002)
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Email is already in use');
      }
      throw error;
    }

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

  private readonly CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

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
    if (outBox.status === 'PROCESSED') {
      throw new BadRequestException(
        'This verification code has already been used',
      );
    }
    if (
      Date.now() - new Date(outBox.createdAt).getTime() >
      this.CODE_EXPIRY_MS
    ) {
      throw new BadRequestException('Verification code has expired');
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

    // emit() là fire-and-forget, outbox pattern đảm bảo reliability
    this.emailWorker.sendResetPasswordEmail(email, resetToken);

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
    if (outBox.status === 'PROCESSED') {
      throw new BadRequestException('This reset code has already been used');
    }
    if (
      Date.now() - new Date(outBox.createdAt).getTime() >
      this.CODE_EXPIRY_MS
    ) {
      throw new BadRequestException('Reset code has expired');
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

  async login(dto: LoginDto, ipAddress: string, response: Response) {
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
      ipAddress,
    );

    if (!session) {
      await this.revokeTokens(availableUser.id);
      return null;
    }

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

    // Generate new tokens (include role from DB)
    const newTokens = await this.tokenService.generateTokens({
      id: availableUser.id,
      email: availableUser.email,
      role: availableUser.role,
    });
    const newHashRefreshToken = await this.hashTextByArgon2(
      newTokens.refreshToken,
    );

    // Update DB FIRST — if this fails, no cookies are set
    await this.tokenService.updateSession(sessionId, newHashRefreshToken);

    // Set cookies ONLY after DB update succeeds
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const cookieOptions = getAuthCookieOptions(isProduction);

    res.clearCookie(AUTH_COOKIE_NAME.ACCESS_TOKEN, { path: '/' });
    res.clearCookie(AUTH_COOKIE_NAME.REFRESH_TOKEN, { path: '/' });

    res.cookie(
      AUTH_COOKIE_NAME.ACCESS_TOKEN,
      newTokens.accessToken,
      cookieOptions,
    );
    res.cookie(
      AUTH_COOKIE_NAME.REFRESH_TOKEN,
      newTokens.refreshToken,
      cookieOptions,
    );

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

  async revokeTokens(userId: string) {
    return await this.tokenService.deleteALlSessionWithUserId(userId);
  }
}
