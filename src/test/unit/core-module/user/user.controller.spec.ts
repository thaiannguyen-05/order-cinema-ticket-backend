import { UserController } from '../../../../module/core-module/user/user.controller';

describe('UserController', () => {
  it('injects email from request payload and delegates update', async () => {
    const userService = {
      updateUserByEmail: jest.fn().mockResolvedValue({ id: 'u1' }),
    };

    const controller = new UserController(userService as never);
    const req = { payload: { email: 'a@example.com' } };
    const dto = { fullname: 'New Name' };

    await expect(
      controller.updateUser(req as never, dto as never),
    ).resolves.toEqual({ id: 'u1' });
    expect(userService.updateUserByEmail).toHaveBeenCalledWith({
      fullname: 'New Name',
      email: 'a@example.com',
    });
  });
});
