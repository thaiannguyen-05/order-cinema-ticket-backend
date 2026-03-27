import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { connect as connectAmqp } from 'amqplib';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import type { Request } from 'express';
import helmet from 'helmet';
import Redis from 'ioredis';
import { AppModule } from './app.module';
import { AddHeaderMiddleware } from './core/middleware/add.header.middleware';
import { QUEUE_NAME } from './background/email/constant/event.type';
import { MyLogger } from './core/logger/logger.service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForRabbitMQConnection(
  rabbitUrl: string,
  logger: MyLogger,
  timeoutMs = 120_000,
  retryDelayMs = 3_000,
): Promise<void> {
  const start = Date.now();
  let attempt = 0;

  while (Date.now() - start < timeoutMs) {
    attempt += 1;
    try {
      const connection = await connectAmqp(rabbitUrl);
      await connection.close();
      return;
    } catch (error) {
      if (attempt === 1 || attempt % 5 === 0) {
        logger.warn(
          `[bootstrap] Waiting for RabbitMQ (attempt ${attempt}): ${String(error)}`,
          'Bootstrap',
        );
      }
      await sleep(retryDelayMs);
    }
  }

  throw new Error(
    `RabbitMQ is not reachable after ${Math.floor(timeoutMs / 1000)}s: ${rabbitUrl}`,
  );
}

async function waitForRedisConnection(
  redisUrl: string,
  logger: MyLogger,
  timeoutMs = 120_000,
  retryDelayMs = 3_000,
): Promise<void> {
  const start = Date.now();
  let attempt = 0;

  while (Date.now() - start < timeoutMs) {
    attempt += 1;
    const client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    client.on('error', () => {});
    try {
      await client.connect();
      await client.ping();
      await client.quit();
      return;
    } catch (error) {
      await client.disconnect();
      if (attempt === 1 || attempt % 5 === 0) {
        logger.warn(
          `[bootstrap] Waiting for Redis (attempt ${attempt}): ${String(error)}`,
          'Bootstrap',
        );
      }
      await sleep(retryDelayMs);
    }
  }

  throw new Error(
    `Redis is not reachable after ${Math.floor(timeoutMs / 1000)}s: ${redisUrl}`,
  );
}

async function bootstrap() {
  const bootstrapLogger = new MyLogger();
  const rabbitUser = process.env.RABBITMQ_USER;
  const rabbitPass = process.env.RABBITMQ_PASS;
  const rabbitPort = process.env.RABBITMQ_PORT;
  const rabbitHost = process.env.RABBITMQ_HOST || 'localhost';
  const rabbitVhost = process.env.RABBITMQ_VHOST || '';
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = process.env.REDIS_PORT;

  if (!rabbitUser || !rabbitPass || !rabbitPort || !redisPort) {
    throw new Error(
      'Missing required env vars before bootstrap: RABBITMQ_USER, RABBITMQ_PASS, RABBITMQ_PORT, REDIS_PORT',
    );
  }

  const rabbitUrl = `amqp://${rabbitUser}:${rabbitPass}@${rabbitHost}:${rabbitPort}/${rabbitVhost}`;
  const redisUrl = `redis://${redisHost}:${redisPort}`;

  await waitForRabbitMQConnection(rabbitUrl, bootstrapLogger);
  await waitForRedisConnection(redisUrl, bootstrapLogger);

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitUrl],
      queue: QUEUE_NAME.GMAIL_SERVICE,
      queueOptions: {
        durable: true,
      },
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitUrl],
      queue: QUEUE_NAME.SYNC_DATE_SERVICE,
      queueOptions: {
        durable: true,
      },
    },
  });

  {
    // values
    const port = configService.getOrThrow<string>('PORT');
    const allowedOrigins = configService
      .get<string>('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (error: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    });
    const isDevelopment =
      configService.get<string>('NODE_ENV', 'development') === 'development';

    // apply middleware
    const addHeaderMiddleware = new AddHeaderMiddleware();
    app.use(addHeaderMiddleware.use.bind(addHeaderMiddleware));

    // using safety
    app.use(helmet());
    app.use(cookieParser());
    if (!isDevelopment) {
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

      app.use(doubleCsrfProtection);
    }

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Order Cinema Ticket Backend API')
      .setDescription('REST API documentation for Order Cinema Ticket Backend')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Input JWT access token',
        },
        'bearerAuth',
      )
      .addCookieAuth(
        'refreshToken',
        {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'HTTP-only refresh token cookie',
        },
        'refreshToken',
      )
      .addCookieAuth(
        'sessionId',
        {
          type: 'apiKey',
          in: 'cookie',
          name: 'sessionId',
          description: 'HTTP-only session identifier cookie',
        },
        'sessionId',
      )
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
      deepScanRoutes: true,
    });

    SwaggerModule.setup('docs', app, swaggerDocument, {
      jsonDocumentUrl: 'docs/json',
      yamlDocumentUrl: 'docs/yaml',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    await app.startAllMicroservices();
    await app.listen(port);
  }
}
void bootstrap();
