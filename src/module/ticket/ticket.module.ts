import { Module } from '@nestjs/common';
import { RedisModule } from '../../background/redis/redis.module';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';

@Module({
  imports: [RedisModule],
  controllers: [TicketController],
  providers: [TicketService],
})
export class TicketModule {}
