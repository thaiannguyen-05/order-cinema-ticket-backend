import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import type { Request } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AddHeaderMiddleware } from './core/middleware/add.header.middleware';
import { QUEUE_NAME } from './background/email/constant/event.type';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [
        `amqp://${configService.getOrThrow<string>('RABBITMQ_USER')}:${configService.getOrThrow<string>('RABBITMQ_PASS')}@${configService.get<string>('RABBITMQ_HOST', 'localhost')}:${configService.getOrThrow<string>('RABBITMQ_PORT')}/${configService.get<string>('RABBITMQ_VHOST', '')}`,
      ],
      queue: QUEUE_NAME.GMAIL_SERVICE,
      queueOptions: {
        durable: true,
      },
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
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
  });

  // values
  const port = configService.getOrThrow<string>('PORT');
  const allowedOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });
  const csrfSecret = configService.get<string>(
    'CSRF_SECRET',
    configService.getOrThrow<string>('JWT_SECRET'),
  );

  const { doubleCsrfProtection } = doubleCsrf({
    getSecret: () => csrfSecret,
    getSessionIdentifier: (req: Request) =>
      `${req.ip ?? ''}-${req.headers['user-agent'] ?? ''}`,
    cookieName: '__Host-csrf-token',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
      path: '/',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  });

  // apply middleware
  const addHeaderMiddleware = new AddHeaderMiddleware();
  app.use(addHeaderMiddleware.use.bind(addHeaderMiddleware));

  // using safety
  app.use(helmet());
  app.use(cookieParser());
  app.use(doubleCsrfProtection);

  await app.startAllMicroservices();
  await app.listen(port);
}
void bootstrap();
