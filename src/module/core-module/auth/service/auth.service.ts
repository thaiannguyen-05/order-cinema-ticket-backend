import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { EVENT_NAME } from '../../../../background/email/constant/event.constant';
import { EmailWorker } from '../../../../background/email/email.worker';
import { OutboxService } from '../../../../background/email/outbox.service';
import type { JwtPayload } from '../../../../core';
import { InvalidCredentialsException, InvalidRefreshTokenException } from '../../../../core/exception/auth.exception';
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
import { generateCode, hashTextByArgon2, verifyTextByArgon2 } from './helper';
import { EmailPayload } from '../../../../background/email/type';
import { CODE_EXPIRY_MS } from './type';
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly emailWorker: EmailWorker,
    private readonly logger: MyLogger,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly outboxService: OutboxService,
  ) { }

  async register(dto: RegisterDto) {
    const availableUser = await this.userService.isAvailableEmail(dto.email);
    if (availableUser) {
      throw new ConflictException('Email is already in use');
    }

    const hashedPassword = await hashTextByArgon2(dto.password);
    const newUser = await this.userService.createUser({
      ...dto,
      hashedPassword,
    });

    const result: UserWithoutPassword = {
      id: newUser.id,
      fullname: newUser.fullname,
      email: newUser.email,
      address: newUser.address,
      dateOfBirth: newUser.dateOfBirth,
    };

    const verificationCode = generateCode();
    const payload: EmailPayload = {
      email: dto.email,
      code: verificationCode,
    };
    const outbox = await this.outboxService.createOutboxMessage(
      EVENT_NAME.SEND_VERIFY_CODE,
      payload,
    );
    this.emailWorker.sendVerifyCode(dto.email, verificationCode);

    return {
      outbox,
      result,
    };
  }


  async verifyEmail(dto: VerifyEmailDto): Promise<boolean> {
    const availableUser = await this.userService.isAvailableEmail(dto.email);
    if (!availableUser) {
      throw new NotFoundException('User not found');
    }

    const outBox = await this.outboxService.getOutBox(dto.outBoxId);
    if (!outBox) {
      throw new NotFoundException('Code is expired or system has some errors');
    }

    if (outBox.eventType !== EVENT_NAME.SEND_VERIFY_CODE) {
      throw new BadRequestException('Invalid verification request');
    }
    if (outBox.status === 'PROCESSED') {
      throw new BadRequestException(
        'This verification code has already been used',
      );
    }
    if (
      Date.now() - new Date(outBox.createdAt).getTime() >
      CODE_EXPIRY_MS
    ) {
      throw new BadRequestException('Verification code has expired');
    }

    const payload: EmailPayload = {
      email: outBox.email,
      code: outBox.code,
    };
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

    const outBox = await this.outboxService.getOutBox(email);
    if (outBox?.createdAt && Date.now() - new Date(outBox.createdAt).getTime() < CODE_EXPIRY_MS) {
      throw new BadRequestException(
        'A reset password request has already been sent. Please check your email.',
      );
    }

    if (outBox && outBox.status === 'PENDING') {
      throw new BadRequestException(
        'A reset password request is already pending. Please check your email.',
      );
    }


    const payload: EmailPayload = {
      email: email,
      code: generateCode(),
    };
    const resetToken = generateCode();
    const outbox = await this.outboxService.createOutboxMessage(
      EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL,
      payload
    );

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
      CODE_EXPIRY_MS
    ) {
      throw new BadRequestException('Reset code has expired');
    }
    if (outBox.eventType !== EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL) {
      throw new BadRequestException('Invalid reset password request');
    }

    const payload: EmailPayload = {
      email: outBox.email,
      code: outBox.code,
    };
    if (!payload.code) {
      throw new BadRequestException('Verification code is invalid');
    }
    if (payload.code !== dto.code) {
      throw new BadRequestException('Invalid verification code');
    }
    if (payload.email !== dto.email) {
      throw new BadRequestException('Invalid verification code');
    }

    const hashedPassword = await hashTextByArgon2(dto.newPassword);

    await Promise.all([
      this.userService.updateUserByEmail({
        email: dto.email,
        hashedPassword: hashedPassword,
      }),
      this.outboxService.updateOutboxMessage(dto.outBoxId, 'PROCESSED'),
    ]);

    return true;
  }

  async login(dto: LoginDto, ipAddress: string, response: Response) {
    const availableUser = await this.userService.getUserByEmail(dto.email);

    if (!availableUser) {
      throw new InvalidCredentialsException('USER_NOT_FOUND');
    }

    if (availableUser.status !== 'ACTIVE') {
      throw new InvalidCredentialsException('INACTIVE_USER');
    }

    const isValidPassword = await verifyTextByArgon2(
      availableUser.hashPassword,
      dto.password,
    );
    if (!isValidPassword) {
      throw new InvalidCredentialsException('INVALID_PASSWORD');
    }

    const token = await this.tokenService.generateTokens(availableUser);
    const hashRefreshToken = await hashTextByArgon2(token.refreshToken);
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
    const sessionId = req.cookies[AUTH_COOKIE_NAME.SESSION_ID];
    if (!sessionId) {
      throw new InvalidRefreshTokenException('MISSING_SESSION_ID');
    }
    const session = await this.tokenService.getSessionById(sessionId);
    if (!session) {
      throw new InvalidRefreshTokenException('SESSION_NOT_FOUND');
    }

    const refreshToken = req.cookies[AUTH_COOKIE_NAME.REFRESH_TOKEN];
    if (!refreshToken) {
      throw new InvalidRefreshTokenException('MISSING_TOKEN');
    }

    const isValidRefreshToken = await verifyTextByArgon2(
      session.hashRefreshToken,
      refreshToken,
    );
    if (!isValidRefreshToken) {
      throw new InvalidRefreshTokenException('INVALID_TOKEN');
    }

    const payload: JwtPayload =
      await this.tokenService.verifyToken(refreshToken);
    if (payload.id !== session.userId) {
      throw new InvalidRefreshTokenException('USER_MISMATCH');
    }

    const availableUser = await this.userService.getUserById(payload.id);
    if (!availableUser) {
      throw new InvalidRefreshTokenException('USER_NOT_FOUND');
    }

    const newTokens = await this.tokenService.generateTokens({
      id: availableUser.id,
      email: availableUser.email,
      role: availableUser.role,
    });
    const newHashRefreshToken = await hashTextByArgon2(
      newTokens.refreshToken,
    );

    await this.tokenService.updateSession(sessionId, newHashRefreshToken);


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
    const sessionId = req.cookies[AUTH_COOKIE_NAME.SESSION_ID];
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
