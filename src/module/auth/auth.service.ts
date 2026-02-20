import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash } from 'argon2';
import { EmailWorker } from '../../background/email/email.worker';
import { RedisService } from '../../background/redis/redis.service';
import { REDIS_KEY, REDIS_TTL } from '../../background/redis/redis.value';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { MyLogger } from '../../logger/logger.service';
import { UserWithoutPassword } from './type/return.type';
import { VreifyEmailDto } from './dto/verify.dto';
import { ResetPasswordDto } from './dto/reset.password.dto';
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly emailWorker: EmailWorker,
    private readonly redisService: RedisService,
    private readonly logger: MyLogger,
  ) {}

  private hashPassword(password: string): Promise<string> {
    return hash(password);
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async register(dto: RegisterDto): Promise<UserWithoutPassword> {
    const availableUser = await this.userService.isAvailableEmail(dto.email);
    if (availableUser) {
      throw new UnauthorizedException('Email is already in use');
    }

    const hashedPassword = await this.hashPassword(dto.password);

    const verificationCode = this.generateCode();
    const key = REDIS_KEY.REGISTER_USER(dto.email);
    await this.redisService.set(key, verificationCode, REDIS_TTL.SHORT_TL);
    this.logger.debug(
      `Generated verification code for ${dto.email}: ${verificationCode}`,
    );

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

  async verifyEmail(dto: VreifyEmailDto): Promise<boolean> {
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
    const key = REDIS_KEY.FOGOT_PASSWORD(email);
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

    const key = REDIS_KEY.FOGOT_PASSWORD(dto.email);
    const storedToken = await this.redisService.get(key);
    if (!storedToken) {
      throw new BadRequestException('Reset token has expired');
    }
    if (storedToken !== dto.code) {
      throw new BadRequestException('Invalid reset token');
    }

    const hashedPassword = await this.hashPassword(dto.newPassword);
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
}
