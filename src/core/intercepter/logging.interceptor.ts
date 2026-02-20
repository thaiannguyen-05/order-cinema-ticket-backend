import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { MyLogger } from '../../logger/logger.service';
import { Request } from 'express';
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: MyLogger) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const contextRequest = context.switchToHttp();
    const request = contextRequest.getRequest<Request>();

    this.logger.log(`[${request.method}] ${request.url} - Request received`);

    return next.handle();
  }
}
