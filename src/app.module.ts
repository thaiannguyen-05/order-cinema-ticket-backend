import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailModule } from './background/email/email.module';
import { PrismaModule } from './background/prisma/prisma.module';
import { RedisModule } from './background/redis/redis.module';
import { ErrorException } from './core/exception/error.exception';
import { AuthenticationGuard } from './core/guard/authentication.guard';
import { ThrottlerBehindProxyGuard } from './core/guard/proxy.ratelimit.guard';
import { RolesGuard } from './core/guard/roles.guard';
import { LoggingInterceptor } from './core/intercepter/logging.interceptor';
import { ResponseInterceptor } from './core/intercepter/response.interceptor';
import { SyncDataCronJobModule } from './background/sync-data-cron-job/sync-data-cron-job.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AuthModule } from './module/core-module/auth/auth.module';
import { FilmModule } from './module/theater-module/film/film.module';
import { CinemaModule } from './module/theater-module/cinema/cinema.module';
import { UserModule } from './module/core-module/user/user.module';
import { LoggerModule } from './core/logger/logger.module';
import { SeatModule } from './module/theater-module/seat/seat.module';
import { TicketModule } from './module/theater-module/ticket/ticket.module';
import { OutboxCronJobModule } from './background/outbox-cron-job/outbox-cron-job.module';
import { TrackingFrequentDataModule } from './background/tracking-frequent-data/tracking-frequent-data.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 50,
      },
    ]),
    LoggerModule,
    AuthModule,
    PrismaModule,
    EmailModule,
    RedisModule,
    HttpModule,
    FilmModule,
    CinemaModule,
    SeatModule,
    TicketModule,
    UserModule,
    SyncDataCronJobModule,
    OutboxCronJobModule,
    TrackingFrequentDataModule,
    ScheduleModule.forRoot({}),
    PrometheusModule.register({
      global: true,
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ErrorException,
    },
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
