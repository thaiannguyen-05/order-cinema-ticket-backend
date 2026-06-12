import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../background/prisma/prisma.service';
import { CreateTrackingDto } from './dto/create-tracking.dto';

@Injectable()
export class TrackingService {
  constructor(private readonly prismaService: PrismaService) {}

  async createTrackingRecord(dto: CreateTrackingDto) {
    return await this.prismaService.eventTracking.create({
      data: {
        userId: dto.userId,
        eventType: dto.eventType,
        page: dto.page,
        elementType: dto.elementType,
        elementId: dto.elementId,
        elementText: dto.elementText,
        targetId: dto.targetId,
        metadata: dto.metadata,
      },
    });
  }
}
