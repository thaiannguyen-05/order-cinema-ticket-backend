import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SyncDataCronJobService } from './sync-data-cron-job.service';
import { QUEUE_NAME } from '../email/constant/event.type';
import { RedisModule } from '../redis/redis.module';
import { SyncDateCronJobConsumer } from './sync-data-cron-job.consumer';
import { EventCronJobWorkerService } from './event.cron-job.worker';
import { CallMovieGluService } from './call-movie-glu.service';
import { CinemaModule } from '../../module/theater/cinema/cinema.module';
import { FilmModule } from '../../module/theater/film/film.module';

@Module({
  imports: [
    CinemaModule,
    RedisModule,
    FilmModule,
    ClientsModule.registerAsync([
      {
        name: QUEUE_NAME.SYNC_DATE_SERVICE,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              `amqp://${configService.getOrThrow<string>('RABBITMQ_USER')}:${configService.getOrThrow<string>('RABBITMQ_PASS')}@${configService.get<string>('RABBITMQ_HOST', 'localhost')}:${configService.getOrThrow<string>('RABBITMQ_PORT')}/${configService.get<string>('RABBITMQ_VHOST', '')}`,
            ],
            queue: QUEUE_NAME.SYNC_DATE_SERVICE,
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
  ],
  controllers: [SyncDateCronJobConsumer],
  providers: [
    SyncDataCronJobService,
    EventCronJobWorkerService,
    CallMovieGluService,
  ],
})
export class SyncDataCronJobModule {}
