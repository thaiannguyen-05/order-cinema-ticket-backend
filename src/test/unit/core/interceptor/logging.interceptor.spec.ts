import { CallHandler, NestInterceptor } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
jest.mock('../../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));

const { LoggingInterceptor } =
  require('../../../../core/intercepter/logging.interceptor') as {
    LoggingInterceptor: new (logger: unknown) => NestInterceptor;
  };

describe('LoggingInterceptor', () => {
  it('logs request and response payload', async () => {
    const logger = { debug: jest.fn() };
    const interceptor = new LoggingInterceptor(logger as never);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          requestId: 'req-1',
          method: 'POST',
          url: '/api/test',
          headers: { a: 1 },
          body: { hello: 'world' },
        }),
        getResponse: () => ({ statusCode: 201 }),
      }),
    };

    const next: CallHandler = { handle: () => of({ id: '1' }) };

    const response = interceptor.intercept(context as never, next);

    await lastValueFrom(response as never);

    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(logger.debug.mock.calls[0][0]).toContain('HTTP Request');
    expect(logger.debug.mock.calls[1][0]).toContain('HTTP Response');
  });
});
