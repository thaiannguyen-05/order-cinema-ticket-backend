import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, Observable } from 'rxjs';
import { ResponseMapping } from '../type/type';
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ResponseMapping<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseMapping<T>> {
    const contextRequest = context.switchToHttp();
    const request = contextRequest.getRequest<Request>();
    const response = contextRequest.getResponse<Response>();
    return next.handle().pipe(
      map((data: T): ResponseMapping<T> => {
        return {
          success: true,
          code: response.statusCode,
          message: 'Success',
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          requestId: request.requestId,
        };
      }),
    );
  }
}
