import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { Payload } from '../../../core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../background/prisma/prisma.service';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async generateToken(user: User) {
    const payload: Payload = {
      id: user.id,
      email: user.email,
    };
    const accessTokenExpiresIn =
      this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN') ??
      this.configService.getOrThrow<string>('ACCESS_TOKEN_EXPIRE');
    const refreshTokenExpiresIn =
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') ??
      this.configService.getOrThrow<string>('REFRESH_TOKEN_EXPIRE');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: accessTokenExpiresIn as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: refreshTokenExpiresIn as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async handleSession(
    userIp: string,
    userId: string,
    hashRefreshToken: string,
  ) {
    return this.prismaService.session.upsert({
      where: { userIp },
      update: {
        hashRefreshToken,
      },
      create: {
        userId,
        userIp,
        hashRefreshToken,
      },
    });
  }
}
