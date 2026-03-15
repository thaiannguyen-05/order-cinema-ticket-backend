import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { REDIS_KEY, REDIS_TTL } from '../../../../background/redis/redis.value';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('../../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));

const { AuthService } = require('../../../../module/core-module/auth/service/auth.service') as {
  AuthService: new (...args: never[]) => {
    register: (dto: unknown) => Promise<unknown>;
    verifyEmail: (dto: unknown) => Promise<unknown>;
    forgotPassword: (email: string) => Promise<unknown>;
    resetPassword: (dto: unknown) => Promise<unknown>;
    login: (dto: unknown, req: unknown, res: unknown) => Promise<unknown>;
    refreshToken: (req: unknown, res: unknown) => Promise<unknown>;
    logout: (req: unknown, res: unknown) => Promise<unknown>;
  };
};

const { hash, verify } = require('argon2') as {
  hash: jest.Mock;
  verify: jest.Mock;
};

describe('AuthService', () => {
  let service: InstanceType<typeof AuthService>;
  let userService: {
    isAvailableEmail: jest.Mock;
    createUser: jest.Mock;
    deleteUserByEmail: jest.Mock;
    updateUserByEmail: jest.Mock;
    getUserByEmail: jest.Mock;
    getUserById: jest.Mock;
  };
  let emailWorker: {
    sendVerifyCode: jest.Mock;
    sendResetPasswordEmail: jest.Mock;
  };
  let redisService: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
  };
  let logger: { debug: jest.Mock };
  let tokenService: {
    generateTokens: jest.Mock;
    handleSession: jest.Mock;
    getSessionById: jest.Mock;
    updateSession: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    userService = {
      isAvailableEmail: jest.fn(),
      createUser: jest.fn(),
      deleteUserByEmail: jest.fn(),
      updateUserByEmail: jest.fn(),
      getUserByEmail: jest.fn(),
      getUserById: jest.fn(),
    };

    emailWorker = {
      sendVerifyCode: jest.fn(),
      sendResetPasswordEmail: jest.fn(),
    };

    redisService = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    logger = {
      debug: jest.fn(),
    };

    tokenService = {
      generateTokens: jest.fn(),
      handleSession: jest.fn(),
      getSessionById: jest.fn(),
      updateSession: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'development' : undefined)),
    };

    service = new AuthService(
      userService as never,
      emailWorker as never,
      redisService as never,
      logger as never,
      tokenService as never,
      configService as never,
    );

    jest.clearAllMocks();
  });

  it('throws when registering an existing email', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);

    await expect(
      service.register({ email: 'a@example.com', password: 'p' } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('registers user and stores verification code', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    hash.mockResolvedValue('hashed-password');
    userService.isAvailableEmail.mockResolvedValue(false);
    userService.createUser.mockResolvedValue({
      id: 'u1',
      fullname: 'User A',
      email: 'a@example.com',
      address: 'HCM',
      dateOfBirth: new Date('2000-01-01T00:00:00.000Z'),
    });

    const result = await service.register({
      fullname: 'User A',
      email: 'a@example.com',
      password: 'raw-password',
      address: 'HCM',
      dateOfBirth: new Date('2000-01-01T00:00:00.000Z'),
    } as never);

    expect(redisService.set).toHaveBeenCalledWith(
      REDIS_KEY.REGISTER_USER('a@example.com'),
      '100000',
      REDIS_TTL.SHORT_TL,
    );
    expect(emailWorker.sendVerifyCode).toHaveBeenCalledWith('a@example.com', '100000');
    expect(result).toEqual(
      expect.objectContaining({
        id: 'u1',
        email: 'a@example.com',
      }),
    );

    jest.restoreAllMocks();
  });

  it('verifies email with valid code', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    redisService.get.mockResolvedValue('123456');

    await expect(
      service.verifyEmail({ email: 'a@example.com', code: '123456' } as never),
    ).resolves.toBe(true);

    expect(userService.updateUserByEmail).toHaveBeenCalledWith({
      email: 'a@example.com',
      status: 'ACTIVE',
    });
    expect(redisService.del).toHaveBeenCalledWith(REDIS_KEY.REGISTER_USER('a@example.com'));
  });

  it('throws when verify code is invalid', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    redisService.get.mockResolvedValue('654321');

    await expect(
      service.verifyEmail({ email: 'a@example.com', code: '123456' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when forgot password email does not exist', async () => {
    userService.isAvailableEmail.mockResolvedValue(false);

    await expect(service.forgotPassword('a@example.com')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resets password with valid token', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    redisService.get.mockResolvedValue('123456');
    hash.mockResolvedValue('new-hashed-password');

    await expect(
      service.resetPassword({
        email: 'a@example.com',
        code: '123456',
        newPassword: 'new-pass',
      } as never),
    ).resolves.toBe(true);

    expect(userService.updateUserByEmail).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'new-hashed-password',
    });
  });

  it('logs in active user and writes auth cookies', async () => {
    verify.mockResolvedValue(true);
    userService.getUserByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      status: 'ACTIVE',
      hashPassword: 'stored-hash',
    });
    tokenService.generateTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    hash.mockResolvedValue('refresh-hash');
    tokenService.handleSession.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      userIp: '127.0.0.1',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    const response = { cookie: jest.fn() };
    const request = { headers: {}, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } };

    const result = await service.login(
      { email: 'a@example.com', password: 'raw-pass' } as never,
      request as never,
      response as never,
    );

    expect(response.cookie).toHaveBeenCalledTimes(3);
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        session: expect.objectContaining({ id: 's1' }),
      }),
    );
  });

  it('refreshes token and clears old access cookie', async () => {
    tokenService.getSessionById.mockResolvedValue({ id: 's1', userId: 'u1' });
    userService.getUserById.mockResolvedValue({ id: 'u1', email: 'a@example.com' });
    tokenService.generateTokens.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    const req = { cookies: { sessionId: 's1', refreshToken: 'old-refresh' } };
    const res = { clearCookie: jest.fn(), cookie: jest.fn() };

    await expect(service.refreshToken(req as never, res as never)).resolves.toBe(true);

    expect(res.clearCookie).toHaveBeenCalledWith('accessToken', { path: '/' });
    expect(res.cookie).toHaveBeenCalledWith(
      'accessToken',
      'new-access',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(tokenService.updateSession).toHaveBeenCalledWith('s1', 'new-refresh');
  });

  it('throws when logout has no session id', async () => {
    await expect(service.logout({ cookies: {} } as never, {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
