jest.mock('../../../../module/theater-module/ticket/ticket.service', () => ({
  TicketService: class TicketService {},
}));

const { TicketController } = require('../../../../module/theater-module/ticket/ticket.controller') as {
  TicketController: new (...args: never[]) => {
    orderTicket: (dto: unknown, userId: string) => Promise<unknown>;
    findBySeat: (seatId: string, userId: string) => Promise<unknown>;
    findOne: (id: string) => Promise<unknown>;
  };
};

describe('TicketController', () => {
  let ticketService: {
    orderTicket: jest.Mock;
    getTicketsByUserId: jest.Mock;
    getTicketById: jest.Mock;
  };
  let controller: InstanceType<typeof TicketController>;

  beforeEach(() => {
    ticketService = {
      orderTicket: jest.fn(),
      getTicketsByUserId: jest.fn(),
      getTicketById: jest.fn(),
    };

    controller = new TicketController(ticketService as never);
  });

  it('delegates all ticket endpoints', async () => {
    ticketService.orderTicket.mockResolvedValue(undefined);
    ticketService.getTicketsByUserId.mockResolvedValue({ id: 't1' });
    ticketService.getTicketById.mockResolvedValue({ id: 't2' });

    await expect(controller.orderTicket({ seatId: 'seat-1' } as never, 'user-1')).resolves.toBeUndefined();
    await expect(controller.findBySeat('seat-1', 'user-1')).resolves.toEqual({ id: 't1' });
    await expect(controller.findOne('t2')).resolves.toEqual({ id: 't2' });

    expect(ticketService.orderTicket).toHaveBeenCalledWith({ seatId: 'seat-1' }, 'user-1');
    expect(ticketService.getTicketsByUserId).toHaveBeenCalledWith('user-1', 'seat-1');
    expect(ticketService.getTicketById).toHaveBeenCalledWith('t2');
  });
});
