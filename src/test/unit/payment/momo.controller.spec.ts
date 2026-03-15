import type { CreateMomoPaymentDto } from '../../../module/payment/momo/dto/create.momoPayment';
import type { MomoIPNHandler } from '../../../module/payment/momo/dto/momo-ipn.handler';

jest.mock('@andev2005/momo-sdk', () => ({
  MomoClient: jest.fn(),
}));
jest.mock('../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));
jest.mock('../../../background/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../background/redis/redis.lock.service', () => ({
  RedisLockService: class RedisLockService {},
}));

const { MomoController } = require('../../../module/payment/momo/momo.controller') as {
  MomoController: new (...args: never[]) => {
    handleMomoIPN: (dto: MomoIPNHandler) => Promise<unknown>;
    checkPaymentStatus: (orderId: string) => Promise<unknown>;
    createPayment: (userId: string, dto: CreateMomoPaymentDto) => Promise<unknown>;
    paymentResult: (
      resultCode?: string,
      orderId?: string,
      message?: string,
      amount?: string,
      requestId?: string,
      transId?: string,
    ) => string;
  };
};

describe('MomoController', () => {
  const createDto: CreateMomoPaymentDto = {
    amount: 200000,
    orderId: 'ORDER-1',
    orderInfo: 'Cinema ticket payment',
    ticketId: 'ticket-1',
  };

  const ipnDto: MomoIPNHandler = {
    partnerCode: 'partner-code',
    orderId: 'ORDER-1',
    requestId: 'req-1',
    amount: 200000,
    orderInfo: 'Cinema ticket payment',
    orderType: 'momo_wallet',
    transId: 123,
    resultCode: 0,
    message: 'Success',
    payType: 'wallet',
    responseTime: Date.now(),
    extraData: '',
    signature: 'signature',
  };

  let momoService: {
    momoIpnHandler: jest.Mock;
    checkMomoPaymentStatus: jest.Mock;
    createMomoPayment: jest.Mock;
  };
  let controller: InstanceType<typeof MomoController>;

  beforeEach(() => {
    momoService = {
      momoIpnHandler: jest.fn(),
      checkMomoPaymentStatus: jest.fn(),
      createMomoPayment: jest.fn(),
    };

    controller = new MomoController(momoService as never);
  });

  it('delegates momo ipn handling to service', async () => {
    momoService.momoIpnHandler.mockResolvedValue({ resultCode: 0 });

    await expect(controller.handleMomoIPN(ipnDto)).resolves.toEqual({ resultCode: 0 });
    expect(momoService.momoIpnHandler).toHaveBeenCalledWith(ipnDto);
  });

  it('delegates check payment status to service', async () => {
    momoService.checkMomoPaymentStatus.mockResolvedValue({ orderId: 'ORDER-1' });

    await expect(controller.checkPaymentStatus('ORDER-1')).resolves.toEqual({
      orderId: 'ORDER-1',
    });
    expect(momoService.checkMomoPaymentStatus).toHaveBeenCalledWith('ORDER-1');
  });

  it('delegates create payment to service', async () => {
    momoService.createMomoPayment.mockResolvedValue({ payUrl: 'https://momo.vn/url' });

    await expect(controller.createPayment('user-1', createDto)).resolves.toEqual({
      payUrl: 'https://momo.vn/url',
    });
    expect(momoService.createMomoPayment).toHaveBeenCalledWith('user-1', createDto);
  });

  it('renders success payment result html with escaped fields', () => {
    const html = controller.paymentResult(
      '0',
      'ORD<1>',
      'ok "quoted"',
      '200000',
      'REQ&1',
      '<script>alert(1)</script>',
    );

    expect(html).toContain('Thanh toan thanh cong');
    expect(html).toContain('ORD&lt;1&gt;');
    expect(html).toContain('&quot;quoted&quot;');
    expect(html).toContain('REQ&amp;1');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renders failure payment result html when resultCode is not 0', () => {
    const html = controller.paymentResult('99');

    expect(html).toContain('Thanh toan that bai');
    expect(html).toContain('N/A');
  });
});
