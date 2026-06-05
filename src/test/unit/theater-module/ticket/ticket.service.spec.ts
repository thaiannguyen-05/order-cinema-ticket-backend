import {
  REDIS_LOCK_KEY,
  REDIS_TTL,
} from '../../../../background/redis/redis.value';

jest.mock('../../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));

jest.mock('../../../../background/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../../../background/redis/redis.lock.service', () => ({
  RedisLockService: class RedisLockService {},
}));

const { TicketService } =
  require('../../../../module/theater-module/ticket/ticket.service') as {
    TicketService: new (...args: never[]) => {
      createTicket: (dto: unknown, userId: string) => Promise<unknown>;
      getTicketById: (id: string) => Promise<unknown>;
      getTicketsByUserId: (userId: string, seatId: string) => Promise<unknown>;
      orderTicket: (dto: { seatId: string }, userId: string) => Promise<void>;
    };
  };

describe('TicketService', () => {
  let service: InstanceType<typeof TicketService>;
  let prismaService: {
    ticket: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let redisLockService: {
    runExclusive: jest.Mock;
  };
  let logger: {
    debug: jest.Mock;
  };

  beforeEach(() => {
    prismaService = {
      ticket: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    redisLockService = {
      runExclusive: jest.fn(
        async (_key: string, _ttl: number, fn: () => Promise<void>) => fn(),
      ),
    };

    logger = {
      debug: jest.fn(),
    };

    service = new TicketService(
      prismaService as never,
      redisLockService as never,
      logger as never,
    );
  });

  it('creates ticket with generated code', async () => {
    prismaService.ticket.create.mockResolvedValue({ id: 't1' });

    const result = await service.createTicket(
      { price: 100, filmOfCinemaId: 'foc-1', seatId: 'seat-1' } as never,
      'user-1',
    );

    expect(result).toEqual({ id: 't1' });
    expect(prismaService.ticket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        price: 100,
        userId: 'user-1',
        filmOfCinemaId: 'foc-1',
        seatId: 'seat-1',
      }),
    });
  });

  it('gets ticket by id and by user-seat', async () => {
    prismaService.ticket.findUnique
      .mockResolvedValueOnce({ id: 't1' })
      .mockResolvedValueOnce({ id: 't2' });

    await expect(service.getTicketById('t1')).resolves.toEqual({ id: 't1' });
    await expect(
      service.getTicketsByUserId('user-1', 'seat-1'),
    ).resolves.toEqual({ id: 't2' });

    expect(prismaService.ticket.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: 't1' },
    });
    expect(prismaService.ticket.findUnique).toHaveBeenNthCalledWith(2, {
      where: { userId: 'user-1', seatId: 'seat-1' },
    });
  });

  it('orders ticket under redis lock', async () => {
    jest
      .spyOn(service, 'createTicket')
      .mockResolvedValue({ id: 't1' } as never);

    await service.orderTicket({ seatId: 'seat-1' } as never, 'user-1');

    expect(redisLockService.runExclusive).toHaveBeenCalledWith(
      REDIS_LOCK_KEY.ORDER_TICKET('seat-1'),
      REDIS_TTL.LOCK_SERVICE,
      expect.any(Function),
    );
    expect(service.createTicket).toHaveBeenCalledWith(
      { seatId: 'seat-1' },
      'user-1',
    );
  });

  it('throws ConflictException when lock acquisition fails', async () => {
    redisLockService.runExclusive.mockResolvedValue(null);

    await expect(
      service.orderTicket({ seatId: 'seat-1' } as never, 'user-1'),
    ).rejects.toThrow('This seat is being booked by another user');
  });
});
