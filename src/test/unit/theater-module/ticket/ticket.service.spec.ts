jest.mock('../../../../background/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const { TicketService } =
  require('../../../../module/theater-module/ticket/ticket.service') as {
    TicketService: new (...args: never[]) => {
      createTicket: (dto: unknown, userId: string) => Promise<unknown>;
      getTicketById: (id: string) => Promise<unknown>;
      getTicketsByUserId: (userId: string, seatId: string) => Promise<unknown>;
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

  beforeEach(() => {
    prismaService = {
      ticket: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    service = new TicketService(prismaService as never);
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
});
