import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
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
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof Error ? exception.message : 'Internal Server Error';

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
