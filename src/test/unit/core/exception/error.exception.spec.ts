import { BadRequestException } from '@nestjs/common';
import { ErrorException } from '../../../../core/exception/error.exception';

describe('ErrorException', () => {
  it('maps http exception to response body', () => {
    const filter = new ErrorException();
    const send = jest.fn();
    const code = jest.fn().mockReturnValue({ send });

    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/x', requestId: 'req-1' }),
        getResponse: () => ({ code }),
      }),
    };

    filter.catch(new BadRequestException('Invalid input'), host as never);

    expect(code).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 400,
        message: 'Invalid input',
        method: 'GET',
        path: '/x',
        requestId: 'req-1',
      }),
    );
  });

  it('maps unknown exception to 500', () => {
    const filter = new ErrorException();
    const send = jest.fn();
    const code = jest.fn().mockReturnValue({ send });

    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', url: '/y', requestId: 'req-2' }),
        getResponse: () => ({ code }),
      }),
    };

    filter.catch(new Error('boom'), host as never);

    expect(code).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
    );
  });
});
