import { UserService } from '../../../../module/core-module/user/user.service';

describe('UserService', () => {
  let service: UserService;
  let prismaService: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new UserService(prismaService as never);
  });

  it('gets user by email', async () => {
    prismaService.user.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(service.getUserByEmail('a@example.com')).resolves.toEqual({
      id: 'u1',
    });
    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'a@example.com' },
    });
  });

  it('returns true when email is available', async () => {
    jest
      .spyOn(service, 'getUserByEmail')
      .mockResolvedValue({ id: 'u1' } as never);

    await expect(service.isAvailableEmail('a@example.com')).resolves.toBe(true);
  });

  it('returns false when email is not available', async () => {
    jest.spyOn(service, 'getUserByEmail').mockResolvedValue(null as never);

    await expect(service.isAvailableEmail('a@example.com')).resolves.toBe(
      false,
    );
  });

  it('creates user with hashPassword and pending status', async () => {
    prismaService.user.create.mockResolvedValue({ id: 'u1' });

    await service.createUser({
      fullname: 'User A',
      email: 'a@example.com',
      password: 'hashed',
      dateOfBirth: new Date('2000-01-01T00:00:00.000Z'),
      address: 'HCM',
      status: 'PENDING',
    });

    expect(prismaService.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fullname: 'User A',
        email: 'a@example.com',
        hashPassword: 'hashed',
        status: 'PENDING',
      }),
    });
  });

  it('updates user with only provided fields', async () => {
    prismaService.user.update.mockResolvedValue({ id: 'u1' });

    await service.updateUserByEmail({
      email: 'a@example.com',
      fullname: 'User B',
      address: 'Da Nang',
      status: 'ACTIVE',
    });

    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { email: 'a@example.com' },
      data: {
        email: 'a@example.com',
        fullname: 'User B',
        address: 'Da Nang',
        status: 'ACTIVE',
      },
    });
  });

  it('updates dateOfBirth when provided', async () => {
    const dob = new Date('1999-09-09T00:00:00.000Z');
    prismaService.user.update.mockResolvedValue({ id: 'u1' });

    await service.updateUserByEmail({
      email: 'a@example.com',
      dateOfBirth: dob,
    });

    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { email: 'a@example.com' },
      data: {
        email: 'a@example.com',
        dateOfBirth: dob,
      },
    });
  });

  it('persists hashPassword when password is provided', async () => {
    prismaService.user.update.mockResolvedValue({ id: 'u1' });

    await service.updateUserByEmail({
      email: 'a@example.com',
      password: 'new-hash',
    });

    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { email: 'a@example.com' },
      data: {
        email: 'a@example.com',
        password: 'new-hash',
      },
    });
  });
});
