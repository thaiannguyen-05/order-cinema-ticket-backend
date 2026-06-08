jest.mock('../../../../background/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../../../module/theater-module/ticket/ticket.service', () => ({
  TicketService: class TicketService {},
}));

const { PaymentService } =
  require('../../../../module/core-module/payment/payment.service') as {
    PaymentService: new (...args: never[]) => {
      createOrder: (dto: unknown, userId: string) => Promise<unknown>;
      updateOrderStatus: (orderId: string, dto: unknown) => Promise<unknown>;
      createPayment: (dto: unknown, userId: string) => Promise<unknown>;
      updatePayment: (paymentId: number, dto: unknown) => Promise<unknown>;
    };
  };

describe('PaymentService', () => {
  let service: InstanceType<typeof PaymentService>;
  let prismaService: {
    order: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    payment: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let ticketService: { getTicketById: jest.Mock };

  beforeEach(() => {
    prismaService = {
      order: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      payment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    ticketService = { getTicketById: jest.fn() };

    service = new PaymentService(
      prismaService as never,
      ticketService as never,
    );
  });

  describe('createOrder', () => {
    it('creates order when ticket is valid', async () => {
      ticketService.getTicketById.mockResolvedValue({
        id: 'ticket-1',
        userId: 'user-1',
      });
      prismaService.order.findUnique.mockResolvedValue(null);
      prismaService.order.create.mockResolvedValue({ id: 'order-1' });

      const result = await service.createOrder(
        { ticketId: 'ticket-1' } as never,
        'user-1',
      );

      expect(result).toEqual({ id: 'order-1' });
      expect(prismaService.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId: 'ticket-1',
          userId: 'user-1',
        }),
      });
    });

    it('throws NotFoundException when ticket not found', async () => {
      ticketService.getTicketById.mockResolvedValue(null);

      await expect(
        service.createOrder({ ticketId: 'fake-id' } as never, 'user-1'),
      ).rejects.toThrow('Ticket not found');
    });

    it('throws ForbiddenException when ticket belongs to different user', async () => {
      ticketService.getTicketById.mockResolvedValue({
        id: 'ticket-1',
        userId: 'other-user',
      });

      await expect(
        service.createOrder({ ticketId: 'ticket-1' } as never, 'user-1'),
      ).rejects.toThrow('Ticket does not belong to this user');
    });

    it('throws ConflictException when order already exists', async () => {
      ticketService.getTicketById.mockResolvedValue({
        id: 'ticket-1',
        userId: 'user-1',
      });
      prismaService.order.findUnique.mockResolvedValue({ id: 'order-1' });

      await expect(
        service.createOrder({ ticketId: 'ticket-1' } as never, 'user-1'),
      ).rejects.toThrow('An order already exists for this ticket');
    });
  });

  describe('updateOrderStatus', () => {
    it('updates order status when order exists', async () => {
      prismaService.order.findUnique.mockResolvedValue({ id: 'order-1' });
      prismaService.order.update.mockResolvedValue({
        id: 'order-1',
        status: 'CAPTURED',
      });

      const result = await service.updateOrderStatus('order-1', {
        status: 'CAPTURED',
      } as never);

      expect(result).toEqual({ id: 'order-1', status: 'CAPTURED' });
      expect(prismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'CAPTURED' },
      });
    });

    it('throws NotFoundException when order not found', async () => {
      prismaService.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus('fake-id', { status: 'CAPTURED' } as never),
      ).rejects.toThrow('Order not found');
    });
  });

  describe('createPayment', () => {
    it('creates payment with converted amount', async () => {
      prismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
      });
      prismaService.payment.findUnique.mockResolvedValue(null);
      prismaService.payment.create.mockResolvedValue({
        id: 1,
        amount: 15000050,
      });

      const result = await service.createPayment(
        { amount: 150000.5, currency: 'VND', orderId: 'order-1' } as never,
        'user-1',
      );

      expect(result).toEqual({ id: 1, amount: 15000050 });
      expect(prismaService.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 15000050,
          currency: 'VND',
          orderId: 'order-1',
        }),
      });
    });

    it('throws NotFoundException when order not found', async () => {
      prismaService.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createPayment({ orderId: 'fake-id' } as never, 'user-1'),
      ).rejects.toThrow('Order not found');
    });

    it('throws ForbiddenException when order belongs to different user', async () => {
      prismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'other-user',
      });

      await expect(
        service.createPayment({ orderId: 'order-1' } as never, 'user-1'),
      ).rejects.toThrow('Order does not belong to this user');
    });

    it('throws ConflictException when payment already exists', async () => {
      prismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
      });
      prismaService.payment.findUnique.mockResolvedValue({ id: 1 });

      await expect(
        service.createPayment({ orderId: 'order-1' } as never, 'user-1'),
      ).rejects.toThrow('A payment already exists for this order');
    });
  });

  describe('updatePayment', () => {
    it('updates payment with converted amount', async () => {
      prismaService.payment.findUnique.mockResolvedValue({ id: 1 });
      prismaService.payment.findFirst.mockResolvedValue(null);
      prismaService.payment.update.mockResolvedValue({
        id: 1,
        amount: 20000100,
      });

      const result = await service.updatePayment(1, {
        amount: 200001,
      } as never);

      expect(result).toEqual({ id: 1, amount: 20000100 });
      expect(prismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ amount: 20000100 }),
      });
    });

    it('throws NotFoundException when payment not found', async () => {
      prismaService.payment.findUnique.mockResolvedValue(null);

      await expect(service.updatePayment(999, {} as never)).rejects.toThrow(
        'Payment not found',
      );
    });

    it('throws ConflictException when orderId is already used', async () => {
      prismaService.payment.findUnique.mockResolvedValue({ id: 1 });
      prismaService.payment.findFirst.mockResolvedValue({ id: 2 });

      await expect(
        service.updatePayment(1, { orderId: 'order-1' } as never),
      ).rejects.toThrow('A payment already exists for this order');
    });
  });
});
