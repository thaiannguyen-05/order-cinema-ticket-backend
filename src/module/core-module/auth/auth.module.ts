import { Module } from '@nestjs/common';
import { AuthService } from './service/auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserModule } from '../user/user.module';
import { TokenService } from './service/token.service';
import { EmailModule } from '../../../background/email/email.module';
import { PrismaModule } from '../../../background/prisma/prisma.module';
import { RedisModule } from '../../../background/redis/redis.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    UserModule,
    EmailModule,
    PrismaModule,
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService],
  exports: [JwtModule],
})
export class AuthModule {}
