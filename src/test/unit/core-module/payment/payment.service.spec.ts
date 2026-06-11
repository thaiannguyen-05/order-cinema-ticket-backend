jest.mock('../../../../background/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../../../module/theater-module/ticket/ticket.service', () => ({
  TicketService: class TicketService {},
}));

jest.mock(
  '../../../../module/core-module/payment/repository/order.repository',
  () => ({
    OrderRepository: class OrderRepository {},
  }),
);

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
  let orderRepository: {
    findOrderById: jest.Mock;
    findOrderByIdAndUserId: jest.Mock;
    findOrderByTicketId: jest.Mock;
    findPaymentById: jest.Mock;
    findPaymentByOrderId: jest.Mock;
    findPaymentByOrderIdExcluding: jest.Mock;
    createOrder: jest.Mock;
    updateOrderStatus: jest.Mock;
    createPayment: jest.Mock;
    updatePayment: jest.Mock;
  };
  let ticketService: { getTicketById: jest.Mock };

  beforeEach(() => {
    orderRepository = {
      findOrderById: jest.fn(),
      findOrderByIdAndUserId: jest.fn(),
      findOrderByTicketId: jest.fn(),
      findPaymentById: jest.fn(),
      findPaymentByOrderId: jest.fn(),
      findPaymentByOrderIdExcluding: jest.fn(),
      createOrder: jest.fn(),
      updateOrderStatus: jest.fn(),
      createPayment: jest.fn(),
      updatePayment: jest.fn(),
    };

    ticketService = { getTicketById: jest.fn() };

    service = new PaymentService(
      orderRepository as never,
      ticketService as never,
    );
  });

  describe('createOrder', () => {
    it('creates order when ticket is valid', async () => {
      ticketService.getTicketById.mockResolvedValue({
        id: 'ticket-1',
        userId: 'user-1',
      });
      orderRepository.findOrderByTicketId.mockResolvedValue(null);
      orderRepository.createOrder.mockResolvedValue({ id: 'order-1' });

      const result = await service.createOrder(
        { ticketId: 'ticket-1' } as never,
        'user-1',
      );

      expect(result).toEqual({ id: 'order-1' });
      expect(orderRepository.createOrder).toHaveBeenCalledWith({
        ticketId: 'ticket-1',
        userId: 'user-1',
        status: 'AUTHENTICATION_NOT_NEEDED',
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
      orderRepository.findOrderByTicketId.mockResolvedValue({ id: 'order-1' });

      await expect(
        service.createOrder({ ticketId: 'ticket-1' } as never, 'user-1'),
      ).rejects.toThrow('An order already exists for this ticket');
    });
  });

  describe('updateOrderStatus', () => {
    it('updates order status when order exists', async () => {
      orderRepository.findOrderById.mockResolvedValue({ id: 'order-1' });
      orderRepository.updateOrderStatus.mockResolvedValue({
        id: 'order-1',
        status: 'CAPTURED',
      });

      const result = await service.updateOrderStatus('order-1', {
        status: 'CAPTURED',
      } as never);

      expect(result).toEqual({ id: 'order-1', status: 'CAPTURED' });
      expect(orderRepository.updateOrderStatus).toHaveBeenCalledWith({
        orderId: 'order-1',
        status: 'CAPTURED',
      });
    });

    it('throws NotFoundException when order not found', async () => {
      orderRepository.findOrderById.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus('fake-id', { status: 'CAPTURED' } as never),
      ).rejects.toThrow('Order not found');
    });
  });

  describe('createPayment', () => {
    it('creates payment with converted amount', async () => {
      orderRepository.findOrderByIdAndUserId.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
      });
      orderRepository.findPaymentByOrderId.mockResolvedValue(null);
      orderRepository.createPayment.mockResolvedValue({
        id: 1,
        amount: 15000050,
      });

      const result = await service.createPayment(
        { amount: 150000.5, currency: 'VND', orderId: 'order-1' } as never,
        'user-1',
      );

      expect(result).toEqual({ id: 1, amount: 15000050 });
      expect(orderRepository.createPayment).toHaveBeenCalledWith({
        orderId: 'order-1',
        amount: 15000050,
        currency: 'VND',
      });
    });

    it('throws NotFoundException when order not found', async () => {
      orderRepository.findOrderByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.createPayment({ orderId: 'fake-id' } as never, 'user-1'),
      ).rejects.toThrow('Order not found');
    });

    it('throws ForbiddenException when order belongs to different user', async () => {
      orderRepository.findOrderByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.createPayment({ orderId: 'order-1' } as never, 'user-1'),
      ).rejects.toThrow('Order not found');
    });

    it('throws ConflictException when payment already exists', async () => {
      orderRepository.findOrderByIdAndUserId.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
      });
      orderRepository.findPaymentByOrderId.mockResolvedValue({ id: 1 });

      await expect(
        service.createPayment({ orderId: 'order-1' } as never, 'user-1'),
      ).rejects.toThrow('A payment already exists for this order');
    });
  });

  describe('updatePayment', () => {
    it('updates payment with converted amount', async () => {
      orderRepository.findPaymentById.mockResolvedValue({ id: 1 });
      orderRepository.updatePayment.mockResolvedValue({
        id: 1,
        amount: 20000100,
      });

      const result = await service.updatePayment(1, {
        amount: 200001,
      } as never);

      expect(result).toEqual({ id: 1, amount: 20000100 });
      expect(orderRepository.updatePayment).toHaveBeenCalledWith(1, {
        amount: 20000100,
      });
    });

    it('throws NotFoundException when payment not found', async () => {
      orderRepository.findPaymentById.mockResolvedValue(null);

      await expect(service.updatePayment(999, {} as never)).rejects.toThrow(
        'Payment not found',
      );
    });

    it('throws ConflictException when orderId is already used', async () => {
      orderRepository.findPaymentById.mockResolvedValue({ id: 1 });
      orderRepository.findPaymentByOrderIdExcluding.mockResolvedValue({
        id: 2,
      });

      await expect(
        service.updatePayment(1, { orderId: 'order-1' } as never),
      ).rejects.toThrow('A payment already exists for this order');
    });
  });
});
