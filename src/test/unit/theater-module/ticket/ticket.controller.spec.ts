jest.mock('../../../../module/theater-module/ticket/ticket.service', () => ({
  TicketService: class TicketService {},
}));

const { TicketController } =
  require('../../../../module/theater-module/ticket/ticket.controller') as {
    TicketController: new (...args: never[]) => {
      findOne: (id: string) => Promise<unknown>;
    };
  };

describe('TicketController', () => {
  let ticketService: {
    getTicketById: jest.Mock;
  };
  let controller: InstanceType<typeof TicketController>;

  beforeEach(() => {
    ticketService = {
      getTicketById: jest.fn(),
    };

    controller = new TicketController(ticketService as never);
  });

  it('delegates findOne', async () => {
    ticketService.getTicketById.mockResolvedValue({ id: 't2' });

    await expect(controller.findOne('t2')).resolves.toEqual({ id: 't2' });

    expect(ticketService.getTicketById).toHaveBeenCalledWith('t2');
  });
});
