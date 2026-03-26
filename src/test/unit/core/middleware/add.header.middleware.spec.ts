import { AddHeaderMiddleware } from '../../../../core/middleware/add.header.middleware';

describe('AddHeaderMiddleware', () => {
  it('uses provided x-request-id header', () => {
    const middleware = new AddHeaderMiddleware();
    const req: Record<string, unknown> = {
      headers: { 'x-request-id': 'req-abc' },
    };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    middleware.use(req as never, res as never, next as never);

    expect(req.requestId).toBe('req-abc');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-abc');
    expect(next).toHaveBeenCalled();
  });
});
