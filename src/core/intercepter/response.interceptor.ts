import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
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
    const request = contextRequest.getRequest<FastifyRequest>();
    const response = contextRequest.getResponse<FastifyReply>();
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
