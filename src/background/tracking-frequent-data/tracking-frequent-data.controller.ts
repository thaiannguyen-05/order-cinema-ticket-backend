import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrackingFrequentDataService } from './tracking-frequent-data.service';

import { Public } from '../../core/decorator/ispublic.decorator';

@ApiTags('Tracking Frequent Data')
@Controller('tracking-frequent-data')
export class TrackingFrequentDataController {
  constructor(private readonly service: TrackingFrequentDataService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get frequent order data for all users' })
  @ApiOkResponse({ description: 'Returns aggregated frequent data' })
  async getAll() {
    return this.service.getFrequentData();
  }
}
