jest.mock('../../../../background/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const { TicketService } =
  require('../../../../module/theater-module/ticket/ticket.service') as {
    TicketService: new (...args: never[]) => {
      createTicket: (dto: unknown) => Promise<unknown>;
      getTicketById: (id: string) => Promise<unknown>;
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
    );

    expect(result).toEqual({ id: 't1' });
    expect(prismaService.ticket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        price: 100,
        filmOfCinemaId: 'foc-1',
        seatId: 'seat-1',
      }),
    });
  });

  it('gets ticket by id', async () => {
    prismaService.ticket.findUnique.mockResolvedValue({ id: 't1' });

    await expect(service.getTicketById('t1')).resolves.toEqual({ id: 't1' });

    expect(prismaService.ticket.findUnique).toHaveBeenCalledWith({
      where: { id: 't1' },
    });
  });
});
