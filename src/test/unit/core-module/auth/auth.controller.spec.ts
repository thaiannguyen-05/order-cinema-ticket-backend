jest.mock('../../../../module/core-module/auth/service/auth.service', () => ({
  AuthService: class AuthService {},
}));

const { AuthController } = require('../../../../module/core-module/auth/auth.controller') as {
  AuthController: new (...args: never[]) => {
    register: (dto: unknown) => Promise<unknown>;
    verifyEmail: (dto: unknown) => Promise<unknown>;
    forgotPassword: (body: { email: string }) => Promise<unknown>;
    resetPassword: (dto: unknown) => Promise<unknown>;
    login: (dto: unknown, req: unknown, res: unknown) => Promise<unknown>;
    refreshToken: (req: unknown, res: unknown) => Promise<unknown>;
    logout: (req: unknown, res: unknown) => Promise<unknown>;
  };
};

describe('AuthController', () => {
  let authService: {
    register: jest.Mock;
    verifyEmail: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
    login: jest.Mock;
    refreshToken: jest.Mock;
    logout: jest.Mock;
  };
  let controller: InstanceType<typeof AuthController>;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      verifyEmail: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
    };

    controller = new AuthController(authService as never);
  });

  it('delegates register', async () => {
    const dto = { email: 'a@example.com' };
    authService.register.mockResolvedValue({ id: 'u1' });

    await expect(controller.register(dto as never)).resolves.toEqual({ id: 'u1' });
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it('delegates verifyEmail', async () => {
    const dto = { email: 'a@example.com', code: '123456' };
    authService.verifyEmail.mockResolvedValue(true);

    await expect(controller.verifyEmail(dto as never)).resolves.toBe(true);
    expect(authService.verifyEmail).toHaveBeenCalledWith(dto);
  });

  it('delegates forgotPassword', async () => {
    authService.forgotPassword.mockResolvedValue(true);

    await expect(controller.forgotPassword({ email: 'a@example.com' })).resolves.toBe(true);
    expect(authService.forgotPassword).toHaveBeenCalledWith('a@example.com');
  });

  it('delegates resetPassword', async () => {
    const dto = { email: 'a@example.com', code: '123', newPassword: 'new' };
    authService.resetPassword.mockResolvedValue(true);

    await expect(controller.resetPassword(dto as never)).resolves.toBe(true);
    expect(authService.resetPassword).toHaveBeenCalledWith(dto);
  });

  it('delegates login, refreshToken and logout', async () => {
    const req = { cookies: {} };
    const res = {};

    authService.login.mockResolvedValue({ accessToken: 'a' });
    authService.refreshToken.mockResolvedValue(true);
    authService.logout.mockResolvedValue(true);

    await expect(controller.login({} as never, req as never, res as never)).resolves.toEqual({
      accessToken: 'a',
    });
    await expect(controller.refreshToken(req as never, res as never)).resolves.toBe(true);
    await expect(controller.logout(req as never, res as never)).resolves.toBe(true);
  });
});
