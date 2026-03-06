import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { MyLogger } from '../../logger/logger.service';
import { Request, Response } from 'express';
import { tap } from 'rxjs';
import { inspect } from 'util';
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: MyLogger) {}

  private formatValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return inspect(value, { depth: 4, colors: false });
    }
  }

  intercept(context: ExecutionContext, next: CallHandler) {
    const contextRequest = context.switchToHttp();
    const request = contextRequest.getRequest<Request>();
    const response = contextRequest.getResponse<Response>();
    const requestBody: unknown = request.body as unknown;

    this.logger.debug(
      [
        'HTTP Request',
        `requestId: ${request.requestId}`,
        `method: ${request.method}`,
        `path: ${request.url}`,
        `headers:\n${this.formatValue(request.headers)}`,
        `body:\n${this.formatValue(requestBody)}`,
      ].join('\n'),
    );

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        this.logger.debug(
          [
            'HTTP Response',
            `requestId: ${request.requestId}`,
            `method: ${request.method}`,
            `path: ${request.url}`,
            `statusCode: ${response.statusCode}`,
            `body:\n${this.formatValue(responseBody)}`,
          ].join('\n'),
        );
      }),
    );
  }
}
