jest.mock('../../../../module/theater-module/ticket/ticket.service', () => ({
  TicketService: class TicketService {},
}));

const { TicketController } =
  require('../../../../module/theater-module/ticket/ticket.controller') as {
    TicketController: new (...args: never[]) => {
      findBySeat: (seatId: string, userId: string) => Promise<unknown>;
      findOne: (id: string) => Promise<unknown>;
    };
  };

describe('TicketController', () => {
  let ticketService: {
    getTicketsByUserId: jest.Mock;
    getTicketById: jest.Mock;
  };
  let controller: InstanceType<typeof TicketController>;

  beforeEach(() => {
    ticketService = {
      getTicketsByUserId: jest.fn(),
      getTicketById: jest.fn(),
    };

    controller = new TicketController(ticketService as never);
  });

  it('delegates all ticket endpoints', async () => {
    ticketService.getTicketsByUserId.mockResolvedValue({ id: 't1' });
    ticketService.getTicketById.mockResolvedValue({ id: 't2' });

    await expect(controller.findBySeat('seat-1', 'user-1')).resolves.toEqual({
      id: 't1',
    });
    await expect(controller.findOne('t2')).resolves.toEqual({ id: 't2' });

    expect(ticketService.getTicketsByUserId).toHaveBeenCalledWith(
      'user-1',
      'seat-1',
    );
    expect(ticketService.getTicketById).toHaveBeenCalledWith('t2');
  });
});
