import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../../../core/decorator/ispublic.decorator';
import { CreateTrackingDto } from './dto/create-tracking.dto';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTrackingDto) {
    return await this.trackingService.createTrackingRecord(dto);
  }
}
