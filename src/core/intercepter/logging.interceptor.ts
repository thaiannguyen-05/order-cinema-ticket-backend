import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { tap } from 'rxjs';
import { inspect } from 'util';
import { MyLogger } from '../logger/logger.service';
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: MyLogger) {}

  private readonly sensitiveKeys = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'access-token',
    'accessToken',
    'refreshToken',
    'password',
    'token',
    'signature',
  ]);

  private redactSensitive(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactSensitive(item));
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).map(
        ([key, val]) => {
          if (this.sensitiveKeys.has(key)) {
            return [key, '[REDACTED]'];
          }
          return [key, this.redactSensitive(val)];
        },
      );

      return Object.fromEntries(entries);
    }

    return value;
  }

  private formatValue(value: unknown): string {
    const safeValue = this.redactSensitive(value);

    if (typeof safeValue === 'string') {
      return safeValue;
    }

    try {
      return JSON.stringify(safeValue, null, 2);
    } catch {
      return inspect(safeValue, { depth: 4, colors: false });
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
