import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { map, Observable } from 'rxjs';
import { ResponseMapping } from '../type';
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
    return next.handle().pipe(
      map((data: T): ResponseMapping<T> => {
        return {
          success: true,
          code: 200,
          message: 'Success',
          data: Array.isArray(data) ? data : [data],
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          requestId: request.requestId,
        };
      }),
    );
  }
}
