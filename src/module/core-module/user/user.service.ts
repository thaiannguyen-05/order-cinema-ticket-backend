import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create.user.dto';
import { UpdateUser } from './dto/update.user.dto';
import { PrismaService } from '../infra/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async getUserByEmail(email: string) {
    return this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
  }

  async getUserById(id: string) {
    return this.prismaService.user.findUnique({
      where: {
        id,
      },
    });
  }

  async isAvailableEmail(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);
    return user ? true : false;
  }

  async createUser(dto: CreateUserDto) {
    return this.prismaService.user.create({
      data: {
        ...dto,
        hashPassword: dto.hashedPassword,
      },
    });
  }

  async deleteUserByEmail(email: string) {
    return this.prismaService.user.delete({
      where: {
        email,
      },
    });
  }

  async updateUserByEmail(dto: UpdateUser) {
    // Allowlist: only self-editable profile fields. Never spread client DTO:
    // status/role/hashPassword are server-side only (verifyEmail/password flows).
    const data: {
      fullname?: string;
      dateOfBirth?: Date;
      address?: string;
    } = {};
    if (dto.fullname !== undefined) data.fullname = dto.fullname;
    if (dto.dateOfBirth !== undefined) data.dateOfBirth = dto.dateOfBirth;
    if (dto.address !== undefined) data.address = dto.address;
    return this.prismaService.user.update({
      where: {
        email: dto.email,
      },
      data,
    });
  }

  /** Server-side only: verifyEmail PENDING -> ACTIVE. Never exposed to PATCH. */
  async activateUser(email: string) {
    return this.prismaService.user.update({
      where: { email },
      data: { status: 'ACTIVE' },
    });
  }

  /** Server-side only: password reset/change with pre-hashed argon2 value. */
  async updatePasswordHash(email: string, hashedPassword: string) {
    return this.prismaService.user.update({
      where: { email },
      data: { hashPassword: hashedPassword },
    });
  }
}
