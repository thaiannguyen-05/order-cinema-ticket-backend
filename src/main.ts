import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { connect as connectAmqp } from 'amqplib';
import fastifyCookie from '@fastify/cookie';
import fastifyCsrfProtection from '@fastify/csrf-protection';
import fastifyHelmet from '@fastify/helmet';
import type { FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { AppModule } from './app.module';
import { QUEUE_NAME } from './module/core-module/infra/email/constant/event.constant';
import { MyLogger } from './module/core-module/infra/logger/logger.service';
import type { ClosableAmqpConnection } from './core/type/type';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

const safeConnectAmqp = connectAmqp as unknown as (
  url: string,
) => Promise<ClosableAmqpConnection>;

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
      const connection = await safeConnectAmqp(rabbitUrl);
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
      client.disconnect();
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

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );
  const configService = app.get(ConfigService);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

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
      noAck: false,
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitUrl],
      queue: QUEUE_NAME.SYNC_DATA_SERVICE,
      queueOptions: {
        durable: true,
      },
      noAck: false,
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

    await app.register(fastifyHelmet);
    await app.register(fastifyCookie);

    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, origin: boolean | string) => void,
      ) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'), false);
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    });
    const isDevelopment =
      configService.get<string>('NODE_ENV', 'development') === 'development';

    // X-Request-Id hook (thay AddHeaderMiddleware Express app.use)
    const fastify = app.getHttpAdapter().getInstance();
    fastify.addHook('onRequest', async (req: FastifyRequest, reply) => {
      const raw = req.headers['x-request-id'];
      const requestId =
        (Array.isArray(raw) ? raw[0] : raw)?.toString() ?? randomUUID();
      req.requestId = requestId;
      reply.header('X-Request-Id', requestId);
    });

    if (!isDevelopment) {
      await app.register(fastifyCsrfProtection, {
        cookieKey: '__Host-csrf-token',
        cookieOpts: {
          secure: true,
          sameSite: 'lax',
          httpOnly: true,
          path: '/',
        },
        getToken: (req: FastifyRequest) => {
          const h = req.headers as Record<string, unknown>;
          return (
            (h['x-csrf-token'] as string | undefined) ??
            (h['csrf-token'] as string | undefined) ??
            (h['x-xsrf-token'] as string | undefined)
          );
        },
        getUserInfo: (req: FastifyRequest) =>
          `${req.ip ?? ''}-${String(req.headers['user-agent'] ?? '')}`,
      });

      // Bỏ qua GET/HEAD/OPTIONS như ignoredMethods cũ
      fastify.addHook('onRequest', (req, reply, done) => {
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
          done();
          return;
        }
        (
          fastify as unknown as {
            csrfProtection: (
              req: unknown,
              reply: unknown,
              done: () => void,
            ) => void;
          }
        ).csrfProtection(req, reply, done);
      });
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
    await app.listen(Number(port), '0.0.0.0');
  }
}
void bootstrap();
