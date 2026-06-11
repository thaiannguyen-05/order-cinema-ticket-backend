jest.mock('../../../../background/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const { OrderRepository } =
  require('../../../../module/core-module/payment/repository/order.repository') as {
    OrderRepository: new (...args: never[]) => {
      findOrderById: (id: string) => Promise<unknown>;
      findOrderByIdAndUserId: (id: string, userId: string) => Promise<unknown>;
      findOrderByTicketId: (ticketId: string) => Promise<unknown>;
      findPaymentById: (id: number) => Promise<unknown>;
      findPaymentByOrderId: (orderId: string) => Promise<unknown>;
      findPaymentByOrderIdExcluding: (
        orderId: string,
        paymentId: number,
      ) => Promise<unknown>;
      createOrder: (input: unknown) => Promise<unknown>;
      updateOrderStatus: (input: unknown) => Promise<unknown>;
      createPayment: (input: unknown) => Promise<unknown>;
      updatePayment: (id: number, data: unknown) => Promise<unknown>;
      updateOrderAndUpsertPayment: (
        orderId: string,
        status: unknown,
        payment: unknown,
      ) => Promise<unknown>;
    };
  };

describe('OrderRepository', () => {
  let repository: InstanceType<typeof OrderRepository>;
  let prisma: {
    order: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    payment: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (fn) => {
        const mockTx = {
          order: prisma.order,
          payment: prisma.payment,
        };
        return fn(mockTx);
      }),
    };

    repository = new OrderRepository(prisma as never);
  });

  describe('findOrderByIdAndUserId', () => {
    it('calls order.findUnique with composite key', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1' });

      const result = await repository.findOrderByIdAndUserId(
        'order-1',
        'user-1',
      );

      expect(result).toEqual({ id: 'order-1' });
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id_userId: { id: 'order-1', userId: 'user-1' } },
      });
    });
  });

  describe('findOrderById', () => {
    it('calls order.findUnique by id', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order-1' });

      const result = await repository.findOrderById('order-1');

      expect(result).toEqual({ id: 'order-1' });
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
      });
    });
  });

  describe('findOrderByTicketId', () => {
    it('calls order.findUnique by ticketId', async () => {
      prisma.order.findUnique.mockResolvedValue({ ticketId: 'ticket-1' });

      const result = await repository.findOrderByTicketId('ticket-1');

      expect(result).toEqual({ ticketId: 'ticket-1' });
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { ticketId: 'ticket-1' },
      });
    });
  });

  describe('createOrder', () => {
    it('creates order with input data', async () => {
      prisma.order.create.mockResolvedValue({ id: 'order-1' });

      const result = await repository.createOrder({
        ticketId: 'ticket-1',
        userId: 'user-1',
        status: 'AUTHENTICATION_NOT_NEEDED',
      });

      expect(result).toEqual({ id: 'order-1' });
      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId: 'ticket-1',
          userId: 'user-1',
        }),
      });
    });
  });

  describe('findPaymentByOrderId', () => {
    it('calls payment.findUnique by orderId', async () => {
      prisma.payment.findUnique.mockResolvedValue({ id: 1 });

      const result = await repository.findPaymentByOrderId('order-1');

      expect(result).toEqual({ id: 1 });
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { orderId: 'order-1' },
      });
    });
  });

  describe('findPaymentByOrderIdExcluding', () => {
    it('calls payment.findFirst with exclusion filter', async () => {
      prisma.payment.findFirst.mockResolvedValue({ id: 2 });

      const result = await repository.findPaymentByOrderIdExcluding(
        'order-1',
        1,
      );

      expect(result).toEqual({ id: 2 });
      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { orderId: 'order-1', id: { not: 1 } },
      });
    });
  });

  describe('createPayment', () => {
    it('creates payment with input data', async () => {
      prisma.payment.create.mockResolvedValue({ id: 1 });

      const result = await repository.createPayment({
        orderId: 'order-1',
        amount: 10000000,
        currency: 'VND',
      });

      expect(result).toEqual({ id: 1 });
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-1',
          amount: 10000000,
          currency: 'VND',
        }),
      });
    });
  });

  describe('updatePayment', () => {
    it('updates payment with partial data', async () => {
      prisma.payment.update.mockResolvedValue({ id: 1, amount: 20000000 });

      const result = await repository.updatePayment(1, { amount: 20000000 });

      expect(result).toEqual({ id: 1, amount: 20000000 });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { amount: 20000000 },
      });
    });
  });

  describe('updateOrderAndUpsertPayment', () => {
    it('runs transaction with order update and payment upsert', async () => {
      prisma.payment.upsert.mockResolvedValue({ id: 1 });

      const result = await repository.updateOrderAndUpsertPayment(
        'order-1',
        'CAPTURED',
        {
          orderId: 'order-1',
          amount: 10000000,
          currency: 'VND',
        },
      );

      expect(result).toEqual({ id: 1 });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'CAPTURED' },
      });
      expect(prisma.payment.upsert).toHaveBeenCalledWith({
        where: { orderId: 'order-1' },
        create: expect.objectContaining({
          orderId: 'order-1',
          amount: 10000000,
        }),
        update: expect.objectContaining({
          orderStatus: 'CAPTURED',
        }),
      });
    });
  });
});
