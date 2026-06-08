jest.mock('../../../../module/core-module/payment/payment.service', () => ({
  PaymentService: class PaymentService {},
}));

jest.mock('../../../../module/core-module/payment/sepay.service', () => ({
  SepayService: class SepayService {},
}));

const { PaymentController } =
  require('../../../../module/core-module/payment/payment.controller') as {
    PaymentController: new (...args: never[]) => {
      createOrder: (dto: unknown, userId: string) => Promise<unknown>;
      createCheckoutUrl: (dto: unknown, userId: string) => Promise<unknown>;
      updateOrderStatus: (orderId: string, dto: unknown) => Promise<unknown>;
      createPayment: (dto: unknown, userId: string) => Promise<unknown>;
      updatePayment: (paymentId: string, dto: unknown) => Promise<unknown>;
      sepayCallback: (dto: unknown) => Promise<unknown>;
    };
  };

describe('PaymentController', () => {
  let paymentService: {
    createOrder: jest.Mock;
    updateOrderStatus: jest.Mock;
    createPayment: jest.Mock;
    updatePayment: jest.Mock;
  };
  let sepayService: {
    createCheckoutUrl: jest.Mock;
    handleCallback: jest.Mock;
  };
  let controller: InstanceType<typeof PaymentController>;

  beforeEach(() => {
    paymentService = {
      createOrder: jest.fn(),
      updateOrderStatus: jest.fn(),
      createPayment: jest.fn(),
      updatePayment: jest.fn(),
    };

    sepayService = {
      createCheckoutUrl: jest.fn(),
      handleCallback: jest.fn(),
    };

    controller = new PaymentController(
      paymentService as never,
      sepayService as never,
    );
  });

  it('delegates createOrder to service', async () => {
    paymentService.createOrder.mockResolvedValue({ id: 'order-1' });

    await expect(
      controller.createOrder({ ticketId: 'ticket-1' } as never, 'user-1'),
    ).resolves.toEqual({ id: 'order-1' });

    expect(paymentService.createOrder).toHaveBeenCalledWith(
      { ticketId: 'ticket-1' },
      'user-1',
    );
  });

  it('delegates createCheckoutUrl to sepayService', async () => {
    sepayService.createCheckoutUrl.mockResolvedValue({
      checkout_url: 'https://pay.sepay.vn/...',
    });

    await expect(
      controller.createCheckoutUrl(
        { order_invoice_number: 'INV-001' } as never,
        'user-1',
      ),
    ).resolves.toEqual({ checkout_url: 'https://pay.sepay.vn/...' });

    expect(sepayService.createCheckoutUrl).toHaveBeenCalledWith(
      { order_invoice_number: 'INV-001' },
      'user-1',
    );
  });

  it('delegates updateOrderStatus to service', async () => {
    paymentService.updateOrderStatus.mockResolvedValue({
      id: 'order-1',
      status: 'CAPTURED',
    });

    await expect(
      controller.updateOrderStatus('order-1', { status: 'CAPTURED' } as never),
    ).resolves.toEqual({ id: 'order-1', status: 'CAPTURED' });

    expect(paymentService.updateOrderStatus).toHaveBeenCalledWith('order-1', {
      status: 'CAPTURED',
    });
  });

  it('delegates createPayment to service', async () => {
    paymentService.createPayment.mockResolvedValue({ id: 1 });

    await expect(
      controller.createPayment(
        { amount: 100000, currency: 'VND', orderId: 'order-1' } as never,
        'user-1',
      ),
    ).resolves.toEqual({ id: 1 });

    expect(paymentService.createPayment).toHaveBeenCalledWith(
      { amount: 100000, currency: 'VND', orderId: 'order-1' },
      'user-1',
    );
  });

  it('delegates updatePayment to service with numeric id', async () => {
    paymentService.updatePayment.mockResolvedValue({ id: 1 });

    await expect(
      controller.updatePayment('1', { amount: 200000 } as never),
    ).resolves.toEqual({ id: 1 });

    expect(paymentService.updatePayment).toHaveBeenCalledWith(1, {
      amount: 200000,
    });
  });

  it('delegates sepayCallback to sepayService', async () => {
    sepayService.handleCallback.mockResolvedValue({
      success: true,
      status: 'CAPTURED',
    });

    await expect(
      controller.sepayCallback({ signature: 'abc123' } as never),
    ).resolves.toEqual({ success: true, status: 'CAPTURED' });

    expect(sepayService.handleCallback).toHaveBeenCalledWith({
      signature: 'abc123',
    });
  });
});
