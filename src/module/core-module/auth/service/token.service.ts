import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../../background/prisma/prisma.service';
import { Payload } from '../../../../core';
import { UserGenerateTokens } from '../type/type';

const MAX_SESSIONS = 5;

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
      role: user.role,
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
    // Tìm session hiện có cùng IP → update
    const existingSession = await this.prismaService.session.findUnique({
      where: { userId_userIp: { userId, userIp: ipAddress } },
    });

    if (existingSession) {
      return this.prismaService.session.update({
        where: { id: existingSession.id },
        data: { hashRefreshToken },
      });
    }

    // Đếm sessions hiện tại, xóa oldest nếu vượt quá giới hạn
    const sessionCount = await this.prismaService.session.count({
      where: { userId },
    });

    if (sessionCount >= MAX_SESSIONS) {
      const oldestSession = await this.prismaService.session.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'asc' },
      });
      if (oldestSession) {
        await this.prismaService.session.delete({
          where: { id: oldestSession.id },
        });
      }
    }

    // Tạo session mới
    return this.prismaService.session.create({
      data: {
        hashRefreshToken,
        userIp: ipAddress,
        userId,
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
