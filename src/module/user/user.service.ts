import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../background/prisma/prisma.service';
import { CreateUserDto } from './dto/create.user.dto';
import { UpdateUser } from './dto/update.user.dto';

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

  async isAvailableEmail(email: string) {
    const user = await this.getUserByEmail(email);
    return user ? true : false;
  }

  async createUser(dto: CreateUserDto) {
    return this.prismaService.user.create({
      data: {
        fullname: dto.fullname,
        email: dto.email,
        hashPassword: dto.password,
        dateOfBirth: dto.dateOfBirth,
        address: dto.address,
        status: 'PENDING',
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
    return this.prismaService.user.update({
      where: {
        email: dto.email,
      },
      data: {
        ...(dto.fullname !== undefined && { fullname: dto.fullname }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }
}
