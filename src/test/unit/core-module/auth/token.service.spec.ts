import { TokenService } from '../../../../module/core-module/auth/service/token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let prismaService: {
    session: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn((key: string) => {
        const map: Record<string, string | number> = {
          JWT_SECRET: 'secret',
          JWT_ACCESS_EXPIRES_IN: 3600,
          JWT_REFRESH_EXPIRES_IN: 86400,
        };
        return map[key];
      }),
    };

    prismaService = {
      session: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
    };

    service = new TokenService(
      jwtService as never,
      configService as never,
      prismaService as never,
    );
  });

  it('generates one token with proper payload and config', async () => {
    jwtService.signAsync.mockResolvedValue('token-1');

    const user = { id: 'u1', email: 'a@example.com' };
    await expect(service.generateToken(user as never, 'ACCESS')).resolves.toBe(
      'token-1',
    );

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { id: 'u1', email: 'a@example.com' },
      { secret: 'secret', expiresIn: 3600 },
    );
  });

  it('generates access and refresh tokens', async () => {
    jest
      .spyOn(service, 'generateToken')
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const user = { id: 'u1', email: 'a@example.com' };

    await expect(service.generateTokens(user as never)).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('creates new session when none exists for IP', async () => {
    prismaService.session.findUnique.mockResolvedValue(null);
    prismaService.session.count.mockResolvedValue(0);
    prismaService.session.create.mockResolvedValue({ id: 's1' });

    await expect(
      service.handleSession('u1', 'hash', '192.168.1.1'),
    ).resolves.toEqual({ id: 's1' });
    expect(prismaService.session.create).toHaveBeenCalledWith({
      data: { hashRefreshToken: 'hash', userIp: '192.168.1.1', userId: 'u1' },
    });
  });

  it('updates existing session for same IP', async () => {
    prismaService.session.findUnique.mockResolvedValue({ id: 's1' });
    prismaService.session.update.mockResolvedValue({ id: 's1' });

    await expect(
      service.handleSession('u1', 'new-hash', '192.168.1.1'),
    ).resolves.toEqual({ id: 's1' });
    expect(prismaService.session.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { hashRefreshToken: 'new-hash' },
    });
  });

  it('gets and updates session', async () => {
    prismaService.session.findUnique.mockResolvedValue({ id: 's1' });
    prismaService.session.update.mockResolvedValue({ id: 's1' });

    await expect(service.getSessionById('s1')).resolves.toEqual({ id: 's1' });
    await expect(service.updateSession('s1', 'new-hash')).resolves.toEqual({
      id: 's1',
    });
  });

  it('deletes session', async () => {
    prismaService.session.delete.mockResolvedValue({ id: 's1' });

    await expect(service.deleteSession('s1')).resolves.toEqual({ id: 's1' });
    expect(prismaService.session.delete).toHaveBeenCalledWith({
      where: { id: 's1' },
    });
  });

  it('verifies token with jwt secret', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
    });

    await expect(service.verifyToken('refresh-token')).resolves.toEqual({
      id: 'u1',
      email: 'a@example.com',
    });
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('refresh-token', {
      secret: 'secret',
    });
  });
});
