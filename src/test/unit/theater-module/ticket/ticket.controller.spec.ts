jest.mock('../../../../module/theater-module/ticket/ticket.service', () => ({
  TicketService: class TicketService {},
}));

const { TicketController } =
  require('../../../../module/theater-module/ticket/ticket.controller') as {
    TicketController: new (...args: never[]) => {
      createTicket: (dto: unknown) => Promise<unknown>;
      findOne: (id: string) => Promise<unknown>;
    };
  };

describe('TicketController', () => {
  let ticketService: {
    createTicket: jest.Mock;
    getTicketById: jest.Mock;
  };
  let controller: InstanceType<typeof TicketController>;

  beforeEach(() => {
    ticketService = {
      createTicket: jest.fn(),
      getTicketById: jest.fn(),
    };

    controller = new TicketController(ticketService as never);
  });

  it('delegates create and findOne', async () => {
    ticketService.createTicket.mockResolvedValue({ id: 't1' });
    ticketService.getTicketById.mockResolvedValue({ id: 't2' });

    await expect(
      controller.createTicket({ price: 100 } as never),
    ).resolves.toEqual({ id: 't1' });
    await expect(controller.findOne('t2')).resolves.toEqual({ id: 't2' });

    expect(ticketService.createTicket).toHaveBeenCalledWith({ price: 100 });
    expect(ticketService.getTicketById).toHaveBeenCalledWith('t2');
  });
});
