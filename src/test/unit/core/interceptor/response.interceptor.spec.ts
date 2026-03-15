import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from '../../../../core/intercepter/response.interceptor';

describe('ResponseInterceptor', () => {
  it('maps response to unified response mapping', async () => {
    const interceptor = new ResponseInterceptor<string>();

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          url: '/api/test',
          method: 'GET',
          requestId: 'req-1',
        }),
      }),
    };

    const next = {
      handle: () => of('ok'),
    };

    const result = await lastValueFrom(interceptor.intercept(context as never, next as never));

    expect(result.success).toBe(true);
    expect(result.data).toEqual(['ok']);
    expect(result.path).toBe('/api/test');
    expect(result.method).toBe('GET');
    expect(result.requestId).toBe('req-1');
  });
});
