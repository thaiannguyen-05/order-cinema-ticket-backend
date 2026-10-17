jest.mock('../../../../module/core-module/infra/prisma/prisma.service', () => ({
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

  const SHOW_TIME_ID = '11111111-1111-4111-8111-111111111111';
  const SEAT_ID = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    prismaService = {
      ticket: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    service = new TicketService(prismaService as never);
  });

  it('creates ticket with direct foreign keys', async () => {
    prismaService.ticket.create.mockResolvedValue({ id: 't1' });

    const result = await service.createTicket({
      price: 100,
      showTimeId: SHOW_TIME_ID,
      seatId: SEAT_ID,
    } as never);

    expect(result).toEqual({ id: 't1' });
    expect(prismaService.ticket.create).toHaveBeenCalledWith({
      data: {
        price: 100,
        showTimeId: SHOW_TIME_ID,
        seatId: SEAT_ID,
      },
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
