import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EVENT_NAME } from '../../../../background/email/constant/event.type';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('../../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));

const { AuthService } =
  require('../../../../module/core-module/auth/service/auth.service') as {
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
    updateUserByEmail: jest.Mock;
    getUserByEmail: jest.Mock;
    getUserById: jest.Mock;
  };
  let emailWorker: {
    sendVerifyCode: jest.Mock;
    sendResetPasswordEmail: jest.Mock;
  };
  let logger: { debug: jest.Mock };
  let tokenService: {
    generateTokens: jest.Mock;
    handleSession: jest.Mock;
    getSessionById: jest.Mock;
    updateSession: jest.Mock;
    verifyToken: jest.Mock;
    deleteSession: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };
  let outboxService: {
    createOutboxMessage: jest.Mock;
    getOutBox: jest.Mock;
    updateOutboxMessage: jest.Mock;
  };

  beforeEach(() => {
    userService = {
      isAvailableEmail: jest.fn(),
      createUser: jest.fn(),
      updateUserByEmail: jest.fn(),
      getUserByEmail: jest.fn(),
      getUserById: jest.fn(),
    };

    emailWorker = {
      sendVerifyCode: jest.fn(),
      sendResetPasswordEmail: jest.fn(),
    };

    logger = {
      debug: jest.fn(),
    };

    tokenService = {
      generateTokens: jest.fn(),
      handleSession: jest.fn(),
      getSessionById: jest.fn(),
      updateSession: jest.fn(),
      verifyToken: jest.fn(),
      deleteSession: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) =>
        key === 'NODE_ENV' ? 'development' : undefined,
      ),
    };

    outboxService = {
      createOutboxMessage: jest.fn(),
      getOutBox: jest.fn(),
      updateOutboxMessage: jest.fn(),
    };

    service = new AuthService(
      userService as never,
      emailWorker as never,
      logger as never,
      tokenService as never,
      configService as never,
      outboxService as never,
    );

    jest.clearAllMocks();
  });

  it('throws conflict when registering an existing email', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);

    await expect(
      service.register({ email: 'a@example.com', password: 'p' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('registers user and creates outbox message', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    hash.mockResolvedValue('hashed-password');
    userService.isAvailableEmail.mockResolvedValue(false);
    outboxService.createOutboxMessage.mockResolvedValue({ id: 'o1' });
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

    expect(outboxService.createOutboxMessage).toHaveBeenCalled();
    expect(emailWorker.sendVerifyCode).toHaveBeenCalledWith(
      'a@example.com',
      '100000',
    );
    expect(result).toEqual(
      expect.objectContaining({
        outbox: { id: 'o1' },
        result: expect.objectContaining({
          id: 'u1',
          email: 'a@example.com',
        }),
      }),
    );

    jest.restoreAllMocks();
  });

  it('verifies email with valid outbox payload', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.getOutBox.mockResolvedValue({
      id: 'o1',
      eventType: EVENT_NAME.SEND_VERIFY_CODE,
      payload: { email: 'a@example.com', code: '123456' },
    });

    await expect(
      service.verifyEmail({
        email: 'a@example.com',
        code: '123456',
        outBoxId: 'o1',
      } as never),
    ).resolves.toBe(true);

    expect(userService.updateUserByEmail).toHaveBeenCalledWith({
      email: 'a@example.com',
      status: 'ACTIVE',
    });
    expect(outboxService.updateOutboxMessage).toHaveBeenCalledWith(
      'o1',
      'PROCESSED',
    );
  });

  it('throws bad request when verify code is invalid', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.getOutBox.mockResolvedValue({
      id: 'o1',
      eventType: EVENT_NAME.SEND_VERIFY_CODE,
      payload: { email: 'a@example.com', code: '654321' },
    });

    await expect(
      service.verifyEmail({
        email: 'a@example.com',
        code: '123456',
        outBoxId: 'o1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when forgot password email does not exist', async () => {
    userService.isAvailableEmail.mockResolvedValue(false);

    await expect(
      service.forgotPassword('a@example.com'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates outbox and dispatches reset email on forgot password success', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.createOutboxMessage.mockResolvedValue({ id: 'o-reset-1' });

    await expect(service.forgotPassword('a@example.com')).resolves.toEqual({
      id: 'o-reset-1',
    });

    expect(outboxService.createOutboxMessage).toHaveBeenCalledWith(
      EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL,
      expect.objectContaining({
        email: 'a@example.com',
        code: expect.any(String),
      }),
    );
    expect(emailWorker.sendResetPasswordEmail).toHaveBeenCalledWith(
      'a@example.com',
      expect.any(String),
    );
  });

  it('returns true when verify email user is not found/already unavailable', async () => {
    userService.isAvailableEmail.mockResolvedValue(false);

    await expect(
      service.verifyEmail({
        email: 'a@example.com',
        code: '123456',
        outBoxId: 'o1',
      } as never),
    ).resolves.toBe(true);

    expect(outboxService.getOutBox).not.toHaveBeenCalled();
    expect(outboxService.updateOutboxMessage).not.toHaveBeenCalled();
  });

  it('throws not found when verify outbox is missing', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.getOutBox.mockResolvedValue(null);

    await expect(
      service.verifyEmail({
        email: 'a@example.com',
        code: '123456',
        outBoxId: 'o-missing',
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws bad request when verify outbox event type is invalid', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.getOutBox.mockResolvedValue({
      id: 'o1',
      eventType: EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL,
      payload: { email: 'a@example.com', code: '123456' },
    });

    await expect(
      service.verifyEmail({
        email: 'a@example.com',
        code: '123456',
        outBoxId: 'o1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(outboxService.updateOutboxMessage).not.toHaveBeenCalled();
  });

  it('throws bad request when verify payload code is missing', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.getOutBox.mockResolvedValue({
      id: 'o1',
      eventType: EVENT_NAME.SEND_VERIFY_CODE,
      payload: { email: 'a@example.com' },
    });

    await expect(
      service.verifyEmail({
        email: 'a@example.com',
        code: '123456',
        outBoxId: 'o1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws bad request when verify payload email mismatches dto email', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.getOutBox.mockResolvedValue({
      id: 'o1',
      eventType: EVENT_NAME.SEND_VERIFY_CODE,
      payload: { email: 'b@example.com', code: '123456' },
    });

    await expect(
      service.verifyEmail({
        email: 'a@example.com',
        code: '123456',
        outBoxId: 'o1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userService.updateUserByEmail).not.toHaveBeenCalled();
    expect(outboxService.updateOutboxMessage).not.toHaveBeenCalled();
  });

  it('returns true when reset password user is unavailable', async () => {
    userService.isAvailableEmail.mockResolvedValue(false);

    await expect(
      service.resetPassword({
        email: 'a@example.com',
        code: '123456',
        newPassword: 'new-pass',
        outBoxId: 'o1',
      } as never),
    ).resolves.toBe(true);

    expect(outboxService.getOutBox).not.toHaveBeenCalled();
    expect(userService.updateUserByEmail).not.toHaveBeenCalled();
  });

  it('throws not found when reset outbox is missing', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.getOutBox.mockResolvedValue(null);

    await expect(
      service.resetPassword({
        email: 'a@example.com',
        code: '123456',
        newPassword: 'new-pass',
        outBoxId: 'o-missing',
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws bad request when reset outbox event type is invalid', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.getOutBox.mockResolvedValue({
      id: 'o1',
      eventType: EVENT_NAME.SEND_VERIFY_CODE,
      payload: { email: 'a@example.com', code: '123456' },
    });

    await expect(
      service.resetPassword({
        email: 'a@example.com',
        code: '123456',
        newPassword: 'new-pass',
        outBoxId: 'o1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws bad request when reset payload code is missing', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.getOutBox.mockResolvedValue({
      id: 'o1',
      eventType: EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL,
      payload: { email: 'a@example.com' },
    });

    await expect(
      service.resetPassword({
        email: 'a@example.com',
        code: '123456',
        newPassword: 'new-pass',
        outBoxId: 'o1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws bad request when reset payload email mismatches dto email', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.getOutBox.mockResolvedValue({
      id: 'o1',
      eventType: EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL,
      payload: { email: 'b@example.com', code: '123456' },
    });

    await expect(
      service.resetPassword({
        email: 'a@example.com',
        code: '123456',
        newPassword: 'new-pass',
        outBoxId: 'o1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userService.updateUserByEmail).not.toHaveBeenCalled();
    expect(outboxService.updateOutboxMessage).not.toHaveBeenCalled();
  });

  it('resets password with valid outbox payload', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.getOutBox.mockResolvedValue({
      id: 'o1',
      eventType: EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL,
      payload: { email: 'a@example.com', code: '123456' },
    });
    hash.mockResolvedValue('new-hashed-password');

    await expect(
      service.resetPassword({
        email: 'a@example.com',
        code: '123456',
        newPassword: 'new-pass',
        outBoxId: 'o1',
      } as never),
    ).resolves.toBe(true);

    expect(userService.updateUserByEmail).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'new-hashed-password',
    });
    expect(outboxService.updateOutboxMessage).toHaveBeenCalledWith(
      'o1',
      'PROCESSED',
    );
  });

  it('throws unauthorized when login user is not found', async () => {
    userService.getUserByEmail.mockResolvedValue(null);

    await expect(
      service.login(
        { email: 'a@example.com', password: 'raw-pass' } as never,
        {} as never,
        { cookie: jest.fn() } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when login user is not active', async () => {
    userService.getUserByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      status: 'PENDING',
      hashPassword: 'stored-hash',
    });

    await expect(
      service.login(
        { email: 'a@example.com', password: 'raw-pass' } as never,
        {} as never,
        { cookie: jest.fn() } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when login password is invalid', async () => {
    userService.getUserByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      status: 'ACTIVE',
      hashPassword: 'stored-hash',
    });
    verify.mockResolvedValue(false);
    const response = { cookie: jest.fn() };

    await expect(
      service.login(
        { email: 'a@example.com', password: 'wrong-pass' } as never,
        {} as never,
        response as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(response.cookie).not.toHaveBeenCalled();
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
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    const response = { cookie: jest.fn() };
    const request = {
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };

    const result = await service.login(
      { email: 'a@example.com', password: 'raw-pass' } as never,
      request as never,
      response as never,
    );

    expect(response.cookie).toHaveBeenCalledTimes(3);
    expect(result).toBe(true);
  });

  it('throws unauthorized when refresh token has no session id cookie', async () => {
    await expect(
      service.refreshToken(
        { cookies: {} } as never,
        { clearCookie: jest.fn(), cookie: jest.fn() } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when refresh token session is not found', async () => {
    tokenService.getSessionById.mockResolvedValue(null);

    await expect(
      service.refreshToken(
        { cookies: { sessionId: 's1', refreshToken: 'r1' } } as never,
        { clearCookie: jest.fn(), cookie: jest.fn() } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when refresh token cookie is missing', async () => {
    tokenService.getSessionById.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      hashRefreshToken: 'stored-refresh-hash',
    });

    await expect(
      service.refreshToken(
        { cookies: { sessionId: 's1' } } as never,
        { clearCookie: jest.fn(), cookie: jest.fn() } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when refresh token hash verification fails', async () => {
    tokenService.getSessionById.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      hashRefreshToken: 'stored-refresh-hash',
    });
    verify.mockResolvedValue(false);

    await expect(
      service.refreshToken(
        {
          cookies: { sessionId: 's1', refreshToken: 'wrong-refresh' },
        } as never,
        { clearCookie: jest.fn(), cookie: jest.fn() } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when refresh token payload user mismatches session user', async () => {
    tokenService.getSessionById.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      hashRefreshToken: 'stored-refresh-hash',
    });
    verify.mockResolvedValue(true);
    tokenService.verifyToken.mockResolvedValue({
      id: 'u2',
      email: 'a@example.com',
    });

    await expect(
      service.refreshToken(
        { cookies: { sessionId: 's1', refreshToken: 'refresh-1' } } as never,
        { clearCookie: jest.fn(), cookie: jest.fn() } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws unauthorized when refresh token payload user no longer exists', async () => {
    tokenService.getSessionById.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      hashRefreshToken: 'stored-refresh-hash',
    });
    verify.mockResolvedValue(true);
    tokenService.verifyToken.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
    });
    userService.getUserById.mockResolvedValue(null);

    await expect(
      service.refreshToken(
        { cookies: { sessionId: 's1', refreshToken: 'refresh-1' } } as never,
        { clearCookie: jest.fn(), cookie: jest.fn() } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('propagates token verification error on refresh token', async () => {
    tokenService.getSessionById.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      hashRefreshToken: 'stored-refresh-hash',
    });
    verify.mockResolvedValue(true);
    tokenService.verifyToken.mockRejectedValue(new Error('jwt expired'));

    await expect(
      service.refreshToken(
        { cookies: { sessionId: 's1', refreshToken: 'refresh-1' } } as never,
        { clearCookie: jest.fn(), cookie: jest.fn() } as never,
      ),
    ).rejects.toThrow('jwt expired');
  });

  it('refreshes token and clears old access cookie', async () => {
    verify.mockResolvedValue(true);
    hash.mockResolvedValue('new-refresh-hash');
    tokenService.getSessionById.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      hashRefreshToken: 'stored-refresh-hash',
    });
    tokenService.verifyToken.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
    });
    userService.getUserById.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
    });
    tokenService.generateTokens.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    const req = { cookies: { sessionId: 's1', refreshToken: 'old-refresh' } };
    const res = { clearCookie: jest.fn(), cookie: jest.fn() };

    await expect(
      service.refreshToken(req as never, res as never),
    ).resolves.toBe(true);

    expect(res.clearCookie).toHaveBeenCalledWith('accessToken', { path: '/' });
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/' });
    expect(res.cookie).toHaveBeenCalledWith(
      'accessToken',
      'new-access',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'new-refresh',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(tokenService.updateSession).toHaveBeenCalledWith(
      's1',
      'new-refresh-hash',
    );
  });

  it('returns outbox even when email worker emits (fire-and-forget)', async () => {
    userService.isAvailableEmail.mockResolvedValue(true);
    outboxService.createOutboxMessage.mockResolvedValue({ id: 'o-reset-1' });
    // emit() is fire-and-forget, no try/catch needed
    emailWorker.sendResetPasswordEmail.mockReturnValue(undefined);

    const result = await service.forgotPassword('a@example.com');
    expect(result).toEqual({ id: 'o-reset-1' });
  });

  it('throws unauthorized when logout has no session id', async () => {
    await expect(
      service.logout({ cookies: {} } as never, {} as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.todo(
    '[DEFECT-AUTH-ASYNC-001] forgotPassword should catch async queue dispatch rejection (Promise reject), not only sync throw',
  );

  it.todo(
    '[DEFECT-AUTH-REFRESH-001] refreshToken should map jwt verify failure to UnauthorizedException instead of leaking non-HTTP errors',
  );
});
