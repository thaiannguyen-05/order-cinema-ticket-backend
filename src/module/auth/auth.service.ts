import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash } from 'argon2';
import { EmailWorker } from '../../background/email/email.worker';
import { RedisService } from '../../background/redis/redis.service';
import { REDIS_KEY, REDIS_TTL } from '../../background/redis/redis.value';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { MyLogger } from '../../logger/logger.service';
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

  async register(dto: RegisterDto) {
    const availableUser = await this.userService.isAvailableEmail(dto.email);
    if (availableUser) {
      throw new UnauthorizedException('Email is already in use');
    }

    const hashedPassword = await this.hashPassword(dto.password);

    const verificationCode = this.generateCode();
    const key = REDIS_KEY.REGISTER_USER(dto.email);
    await this.redisService.set(key, verificationCode, REDIS_TTL.REGISTER_TTL);
    this.logger.log(
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hashPassword, ...userWithoutPassword } = newUser;

    return userWithoutPassword;
  }
}
