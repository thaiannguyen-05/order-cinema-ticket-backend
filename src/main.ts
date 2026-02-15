import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AddHeaderMiddleware } from './core/middleware/add.header.middleware';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Get the ConfigService instance from the app context
  const configService = app.get(ConfigService);

  // values
  const port = configService.getOrThrow<string>('PORT');

  // apply middleware
  const addHeaderMiddleware = new AddHeaderMiddleware();
  app.use(addHeaderMiddleware.use.bind(addHeaderMiddleware));

  // using safety
  app.use(helmet());
  app.enableCors();
  app.use(cookieParser());

  app.set('trust proxy', true);

  await app.listen(port);
}
void bootstrap();
