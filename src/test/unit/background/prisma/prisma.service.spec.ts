jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation((opts: unknown) => ({ opts })),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {
    constructor(_opts?: unknown) {}
  },
}));

const { PrismaService } = require('../../../../background/prisma/prisma.service') as {
  PrismaService: new (...args: never[]) => unknown;
};

describe('PrismaService', () => {
  it('can be instantiated with config service', () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('postgres://localhost:5432/db'),
    };

    const service = new PrismaService(configService as never);

    expect(service).toBeDefined();
    expect(configService.getOrThrow).toHaveBeenCalledWith('DATABASE_URL');
  });
});
