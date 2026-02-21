import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailModule } from './background/email/email.module';
import { PrismaModule } from './background/prisma/prisma.module';
import { RedisModule } from './background/redis/redis.module';
import { ErrorExcception } from './core/exception/error.exception';
import { AuthenticationGuard } from './core/guard/authentication.guard';
import { ThrottlerBehindProxyGuard } from './core/guard/proxy.ratelimit.guard';
import { LoggingInterceptor } from './core/intercepter/logging.interceptor';
import { ResponseInterceptor } from './core/intercepter/response.interceptor';
import { LoggerModule } from './logger/logger.module';
import { AuthModule } from './module/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),
    LoggerModule,
    AuthModule,
    PrismaModule,
    EmailModule,
    RedisModule,
    LoggerModule,
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
      useClass: ErrorExcception,
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
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
