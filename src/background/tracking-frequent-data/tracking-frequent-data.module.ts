import { Module } from '@nestjs/common';
import { TrackingFrequentDataService } from './tracking-frequent-data.service';
import { TrackingFrequentDataController } from './tracking-frequent-data.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TrackingFrequentDataController],
  providers: [TrackingFrequentDataService],
  exports: [TrackingFrequentDataService],
})
export class TrackingFrequentDataModule {}
