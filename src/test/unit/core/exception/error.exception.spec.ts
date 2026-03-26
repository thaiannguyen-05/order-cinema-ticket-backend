import { BadRequestException } from '@nestjs/common';
import { ErrorExcception } from '../../../../core/exception/error.exception';

describe('ErrorExcception', () => {
  it('maps http exception to response body', () => {
    const filter = new ErrorExcception();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });

    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/x', requestId: 'req-1' }),
        getResponse: () => ({ status }),
      }),
    };

    filter.catch(new BadRequestException('Invalid input'), host as never);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
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
    const filter = new ErrorExcception();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });

    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', url: '/y', requestId: 'req-2' }),
        getResponse: () => ({ status }),
      }),
    };

    filter.catch(new Error('boom'), host as never);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
    );
  });
});
