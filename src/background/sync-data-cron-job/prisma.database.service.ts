import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveCinemasDto } from './dto/save-cinemas.dto';

@Injectable()
export class PrismaDatabaseService {
  constructor(private readonly prismaService: PrismaService) {}

  async savingCinemas(dto: SaveCinemasDto) {
    return await this.prismaService.theater.createMany({
      data: dto.cinemas,
      skipDuplicates: false,
    });
  }
}
