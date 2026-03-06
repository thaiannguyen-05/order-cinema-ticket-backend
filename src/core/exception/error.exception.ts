import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ExceptionResponseMapping } from '../type';
@Catch()
export class ErrorExcception implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const exceptionMessage =
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
        ? exceptionResponse.message
        : null;

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : Array.isArray(exceptionMessage)
          ? exceptionMessage.join(', ')
          : typeof exceptionMessage === 'string'
            ? exceptionMessage
            : exception instanceof Error
              ? exception.message
              : 'Internal Server Error';

    const responseMapping: ExceptionResponseMapping = {
      success: false,
      code: status,
      message,
      timestamp: Date.now().toLocaleString(),
      method: request.method,
      path: request.url,
      requestId: request.requestId,
    };

    response.status(status).json(responseMapping);
  }
}
