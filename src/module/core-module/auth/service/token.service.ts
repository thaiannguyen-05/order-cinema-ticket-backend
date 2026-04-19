import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../../background/prisma/prisma.service';
import { Payload } from '../../../../core';
import { UserGenerateTokens } from '../type/type';
import { Session } from '@prisma/client';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async generateToken(user: UserGenerateTokens, nameToken: string) {
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

  async generateTokens(user: UserGenerateTokens) {
    const accessToken = await this.generateToken(user, 'ACCESS');
    const refreshToken = await this.generateToken(user, 'REFRESH');

    return { accessToken, refreshToken };
  }

  async handleSession(
    userId: string,
    hashRefreshToken: string,
    ipAddress: string,
  ) {
    let availableSession: Session[] = [];
    availableSession = await this.prismaService.session.findMany({
      where: { userId },
    });

    if (availableSession.length === 0) {
      return await this.prismaService.session.create({
        data: {
          hashRefreshToken: hashRefreshToken,
          userIp: ipAddress,
          userId: userId,
        },
      });
    }

    const matchedSesison = availableSession.some(
      (session) => session.userId === userId && session.userIp === ipAddress,
    );

    if (!matchedSesison) return null;

    return await this.prismaService.session.update({
      where: { userId_userIp: { userId: userId, userIp: ipAddress } },
      data: {
        hashRefreshToken: hashRefreshToken,
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

  async deleteSession(sessionId: string) {
    return this.prismaService.session.delete({
      where: { id: sessionId },
    });
  }

  async verifyToken(token: string) {
    const payload: Payload = await this.jwtService.verifyAsync(token, {
      secret: this.configService.getOrThrow('JWT_SECRET'),
    });

    return payload;
  }

  async deleteALlSessionWithUserId(userId: string) {
    return await this.prismaService.session.deleteMany({
      where: { userId: userId },
    });
  }
}
