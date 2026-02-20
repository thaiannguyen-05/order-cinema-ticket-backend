import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import cookieParser from 'cookie-parser';
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

  // values
  const port = configService.getOrThrow<string>('PORT');

  // apply middleware
  const addHeaderMiddleware = new AddHeaderMiddleware();
  app.use(addHeaderMiddleware.use.bind(addHeaderMiddleware));

  // using safety
  app.use(helmet());
  app.enableCors();
  app.use(cookieParser());

  app.getHttpAdapter().getInstance().set('trust proxy', true);

  await app.startAllMicroservices();
  await app.listen(port);
}
void bootstrap();
