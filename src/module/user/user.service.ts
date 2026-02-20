import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../background/prisma/prisma.service';
import { CreateUserDto } from './dto/create.user.dto';

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
}
