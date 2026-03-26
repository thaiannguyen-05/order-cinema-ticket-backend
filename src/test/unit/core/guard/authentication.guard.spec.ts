import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationGuard } from '../../../../core/guard/authentication.guard';

describe('AuthenticationGuard', () => {
  let guard: AuthenticationGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  const makeContext = (request: Record<string, unknown>) => ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
    }),
  });

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    reflector = { getAllAndOverride: jest.fn() };
    configService = { getOrThrow: jest.fn().mockReturnValue('secret') };

    guard = new AuthenticationGuard(
      jwtService as never,
      reflector as never,
      configService as never,
    );
  });

  it('allows public route', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(makeContext({}) as never)).resolves.toBe(
      true,
    );
  });

  it('throws unauthorized when token is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    await expect(
      guard.canActivate(makeContext({ headers: {} }) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verifies bearer token and attaches payload', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verifyAsync.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
    });

    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer token-1' },
    };

    await expect(
      guard.canActivate(makeContext(request) as never),
    ).resolves.toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-1', {
      secret: 'secret',
    });
    expect(request.payload).toEqual({ id: 'u1', email: 'a@example.com' });
  });

  it('falls back to legacy access-token header', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verifyAsync.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
    });

    const request: Record<string, unknown> = {
      headers: { 'access-token': 'token-legacy' },
    };

    await expect(
      guard.canActivate(makeContext(request) as never),
    ).resolves.toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-legacy', {
      secret: 'secret',
    });
  });
});
