import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailModule } from './module/core-module/infra/email/email.module';
import { PrismaModule } from './module/core-module/infra/prisma/prisma.module';
import { RedisModule } from './module/core-module/infra/redis/redis.module';
import { ErrorException } from './core/exception/error.exception';
import { AuthenticationGuard } from './core/guard/authentication.guard';
import { ThrottlerBehindProxyGuard } from './core/guard/proxy.ratelimit.guard';
import { RolesGuard } from './core/guard/roles.guard';
import { LoggingInterceptor } from './core/intercepter/logging.interceptor';
import { ResponseInterceptor } from './core/intercepter/response.interceptor';
import { MetricsInterceptor } from './module/core-module/infra/metrics/metrics.interceptor';
import { ScheduleModule } from '@nestjs/schedule';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { PublicMetricsController } from './app-metrics.controller';
import { RedisThrottlerStorage } from './core/guard/redis-throttler.storage';
import { AuthModule } from './module/core-module/auth/auth.module';
import { FilmModule } from './module/theater-module/film/film.module';
import { CinemaModule } from './module/theater-module/cinema/cinema.module';
import { UserModule } from './module/core-module/user/user.module';
import { LoggerModule } from './module/core-module/infra/logger/logger.module';
import { SeatModule } from './module/theater-module/seat/seat.module';
import { TicketModule } from './module/theater-module/ticket/ticket.module';
import { OutboxCronJobModule } from './module/core-module/infra/outbox-cron-job/outbox-cron-job.module';
import { OrderExpireCronJobModule } from './module/core-module/infra/order-expire-cron-job/order-expire-cron-job.module';
import { PaymentModule } from './module/core-module/payment/payment.module';
import { MetricsModule } from './module/core-module/infra/metrics/metrics.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // NOTE: throttler v6 ttl/blockDuration are in MILLISECONDS.
        // Previous ttl:60 meant 60ms (no throttle). Fixed to 60_000 = 60s.
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: 50,
            blockDuration: 60_000,
          },
          {
            name: 'auth',
            ttl: 60_000,
            limit: 10,
            blockDuration: 60_000,
          },
          {
            name: 'payment',
            ttl: 60_000,
            limit: 20,
            blockDuration: 60_000,
          },
          {
            name: 'webhook',
            ttl: 60_000,
            limit: 60,
            blockDuration: 60_000,
          },
        ],
        storage: new RedisThrottlerStorage(configService),
      }),
    }),
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
    //SyncDataCronJobModule,
    OutboxCronJobModule,
    OrderExpireCronJobModule,
    PaymentModule,
    MetricsModule,
    ScheduleModule.forRoot({}),
    PrometheusModule.register({
      global: true,
      path: '/metrics',
      controller: PublicMetricsController,
      defaultLabels: {
        app: 'order-cinema-ticket-backend',
      },
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
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
