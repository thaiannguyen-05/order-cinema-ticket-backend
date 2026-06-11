jest.mock('../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));

jest.mock(
  '../../../../module/core-module/payment/repository/order.repository',
  () => ({
    OrderRepository: class OrderRepository {},
  }),
);

jest.mock('../../../../background/redis/redis.lock.service', () => ({
  RedisLockService: class RedisLockService {},
}));

jest.mock('@nestjs/axios', () => ({
  HttpModule: {},
  HttpService: class HttpService {},
}));

jest.mock('rxjs', () => ({
  firstValueFrom: jest.fn(async (obs) => obs),
}));

const { SepayService } =
  require('../../../../module/core-module/payment/sepay.service') as {
    SepayService: new (...args: never[]) => {
      signFields: (fields: Record<string, string>) => string;
      createCheckoutUrl: (
        dto: unknown,
        userId: string,
      ) => Promise<{ checkout_url: string }>;
      handleCallback: (dto: unknown) => Promise<unknown>;
    };
  };

describe('SepayService', () => {
  let service: InstanceType<typeof SepayService>;
  let configService: { getOrThrow: jest.Mock };
  let orderRepository: {
    findOrderByIdAndUserId: jest.Mock;
    findOrderById: jest.Mock;
    findPaymentByOrderId: jest.Mock;
    updateOrderAndUpsertPayment: jest.Mock;
  };
  let redisLockService: { runExclusive: jest.Mock };
  let httpService: { postForm: jest.Mock };

  beforeEach(() => {
    configService = { getOrThrow: jest.fn() };

    orderRepository = {
      findOrderByIdAndUserId: jest.fn(),
      findOrderById: jest.fn(),
      findPaymentByOrderId: jest.fn(),
      updateOrderAndUpsertPayment: jest.fn(),
    };

    redisLockService = {
      runExclusive: jest.fn(async (_key, _ttl, fn) => fn()),
    };

    httpService = { postForm: jest.fn() };

    service = new SepayService(
      configService as never,
      orderRepository as never,
      redisLockService as never,
      httpService as never,
    );

    configService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'SEPAY_SECRET_KEY') return 'test-secret-key';
      if (key === 'SEPAY_MERCHANT') return 'MERCHANT_123';
      return 'default';
    });
  });

  describe('signFields', () => {
    it('generates correct HMAC signature', () => {
      const fields = {
        order_amount: '100000',
        merchant: 'MERCHANT_123',
        currency: 'VND',
        operation: 'PURCHASE',
        order_invoice_number: 'INV_001',
      };

      const result = service.signFields(fields);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('only includes allowed fields in signature', () => {
      const fields = {
        order_amount: '100000',
        merchant: 'MERCHANT_123',
        unknown_field: 'should_be_ignored',
      };

      const result = service.signFields(fields);

      expect(result).toBeDefined();
    });

    it('produces same signature for same fields', () => {
      const fields = {
        order_amount: '100000',
        merchant: 'MERCHANT_123',
        currency: 'VND',
      };

      const result1 = service.signFields(fields);
      const result2 = service.signFields(fields);

      expect(result1).toBe(result2);
    });
  });

  describe('createCheckoutUrl', () => {
    const validDto = {
      order_amount: 100000,
      currency: 'VND',
      order_description: 'Test payment',
      order_invoice_number: 'INV_001',
      success_url: 'https://example.com/success',
      error_url: 'https://example.com/error',
      cancel_url: 'https://example.com/cancel',
    };

    it('returns checkout URL when order exists and not paid', async () => {
      orderRepository.findOrderByIdAndUserId.mockResolvedValue({
        id: 'INV_001',
        userId: 'user-1',
      });
      orderRepository.findPaymentByOrderId.mockResolvedValue(null);
      httpService.postForm.mockResolvedValue({
        data: { checkout_url: 'https://pay.sepay.vn/v1/checkout/abc' },
      });

      const result = await service.createCheckoutUrl(
        validDto as never,
        'user-1',
      );

      expect(result).toEqual({
        checkout_url: 'https://pay.sepay.vn/v1/checkout/abc',
      });
    });

    it('throws BadRequestException when order not found', async () => {
      orderRepository.findOrderByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.createCheckoutUrl(validDto as never, 'user-1'),
      ).rejects.toThrow('Order not found');
    });

    it('throws ConflictException when order already paid', async () => {
      orderRepository.findOrderByIdAndUserId.mockResolvedValue({
        id: 'INV_001',
        userId: 'user-1',
      });
      orderRepository.findPaymentByOrderId.mockResolvedValue({ id: 1 });

      await expect(
        service.createCheckoutUrl(validDto as never, 'user-1'),
      ).rejects.toThrow('This order has already been paid');
    });

    it('throws ConflictException when lock acquisition fails', async () => {
      redisLockService.runExclusive.mockResolvedValue(null);

      await expect(
        service.createCheckoutUrl(validDto as never, 'user-1'),
      ).rejects.toThrow('A checkout request is being processed');
    });

    it('throws ServiceUnavailableException when SePay returns no URL', async () => {
      orderRepository.findOrderByIdAndUserId.mockResolvedValue({
        id: 'INV_001',
        userId: 'user-1',
      });
      orderRepository.findPaymentByOrderId.mockResolvedValue(null);
      httpService.postForm.mockResolvedValue({ data: {} });

      await expect(
        service.createCheckoutUrl(validDto as never, 'user-1'),
      ).rejects.toThrow('SePay returned no checkout URL');
    });
  });

  describe('handleCallback', () => {
    const validCallback = {
      order_amount: '100000',
      merchant: 'MERCHANT_123',
      currency: 'VND',
      operation: 'success',
      order_description: 'Test payment',
      order_invoice_number: 'INV_001',
      customer_id: 'user-1',
      payment_method: 'ATM',
      success_url: 'https://example.com/success',
      error_url: 'https://example.com/error',
      cancel_url: 'https://example.com/cancel',
      signature: '',
    };

    beforeEach(() => {
      const fields = { ...validCallback };
      delete (fields as { signature?: string }).signature;
      const validSig = service.signFields(fields);
      validCallback.signature = validSig;
    });

    it('processes valid callback and updates order', async () => {
      orderRepository.findOrderById.mockResolvedValue({
        id: 'INV_001',
        status: 'AUTHENTICATION_NOT_NEEDED',
      });
      orderRepository.updateOrderAndUpsertPayment.mockResolvedValue({
        id: 1,
        amount: 10000000,
      });

      const result = await service.handleCallback(validCallback as never);

      expect(result).toEqual({
        success: true,
        status: 'CAPTURED',
        amount: 100000,
      });
      expect(orderRepository.updateOrderAndUpsertPayment).toHaveBeenCalledWith(
        'INV_001',
        'CAPTURED',
        {
          orderId: 'INV_001',
          amount: 10000000,
          currency: 'VND',
        },
      );
    });

    it('throws BadRequestException for invalid signature', async () => {
      const invalidCallback = { ...validCallback, signature: 'invalid-sig' };

      await expect(
        service.handleCallback(invalidCallback as never),
      ).rejects.toThrow('Invalid SePay signature');
    });

    it('throws BadRequestException when order not found', async () => {
      orderRepository.findOrderById.mockResolvedValue(null);

      await expect(
        service.handleCallback(validCallback as never),
      ).rejects.toThrow('Order INV_001 not found');
    });

    it('sets CANCELLED status for non-success operation', async () => {
      orderRepository.findOrderById.mockResolvedValue({
        id: 'INV_001',
        status: 'AUTHENTICATION_NOT_NEEDED',
      });
      orderRepository.updateOrderAndUpsertPayment.mockResolvedValue({ id: 1 });

      const failedCallback = { ...validCallback, operation: 'failed' };
      failedCallback.signature = service.signFields(failedCallback);

      const result = await service.handleCallback(failedCallback as never);

      expect(result).toMatchObject({ status: 'CANCELLED' });
    });
  });
});
