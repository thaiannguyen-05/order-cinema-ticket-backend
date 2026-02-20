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

  async generateToken(user: User, nameToken: string) {
    const payload: Payload = {
      id: user.id,
      email: user.email,
    };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.configService.getOrThrow<number>(
        `JWT_${nameToken}_EXPIRES_IN`,
      ),
    });
  }

  async generateTokens(user: User) {
    const accessToken = await this.generateToken(user, 'ACCESS');
    const refreshToken = await this.generateToken(user, 'REFRESH');

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

  async getSessionById(sessionId: string) {
    return this.prismaService.session.findUnique({
      where: { id: sessionId },
    });
  }

  async updateSession(sessionId: string, hashRefreshToken: string) {
    return this.prismaService.session.update({
      where: { id: sessionId },
      data: { hashRefreshToken },
    });
  }
}
