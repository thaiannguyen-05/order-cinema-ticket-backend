import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PAYMENT_STATUS } from '@prisma/client';
import {
  REDIS_LOCK_KEY,
  REDIS_TTL,
} from '../../../background/redis/redis.value';
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

const { MomoService } =
  require('../../../module/payment/momo/momo.service') as {
    MomoService: new (...args: never[]) => {
      createMomoPayment: (
        userId: string,
        dto: CreateMomoPaymentDto,
      ) => Promise<unknown>;
      checkMomoPaymentStatus: (orderId: string) => Promise<unknown>;
      momoIpnHandler: (dto: MomoIPNHandler) => Promise<unknown>;
    };
  };

describe('MomoService', () => {
  const configRequired: Record<string, string | number> = {
    MOMO_ACCESS_KEY: 'access-key',
    MOMO_PARTNER_CODE: 'partner-code',
    MOMO_SECRET_KEY: 'secret-key',
    MOMO_ENV: 'production',
    MOMO_BASE_URL: 'https://test-payment.momo.vn',
    MOMO_TIMEOUT_MS: 5000,
    BASE_URL: 'https://api.example.com',
  };

  const configOptional: Record<string, string> = {
    MOMO_PARTNER_NAME: 'Cinema Partner',
    MOMO_STORE_ID: 'cinema-store',
  };

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
    signature: 'raw-signature',
  };

  let service: InstanceType<typeof MomoService>;
  let configService: {
    getOrThrow: jest.Mock;
    get: jest.Mock;
  };
  let redisLockService: {
    runExclusive: jest.Mock;
  };
  let loggerService: {
    debug: jest.Mock;
  };
  let prismaService: {
    momoPayment: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      updateMany: jest.Mock;
    };
    ticket: {
      findUnique: jest.Mock;
    };
  };
  let momoClient: {
    createPayment: jest.Mock;
    queryTransaction: jest.Mock;
    verifyWebhookSignature: jest.Mock;
  };

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (!(key in configRequired)) {
          throw new Error(`Missing config key: ${key}`);
        }
        return configRequired[key];
      }),
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key in configOptional) {
          return configOptional[key];
        }
        return defaultValue;
      }),
    };

    redisLockService = {
      runExclusive: jest.fn(
        async (_resource: string, _ttl: number, fn: () => Promise<unknown>) =>
          fn(),
      ),
    };

    loggerService = {
      debug: jest.fn(),
    };

    prismaService = {
      momoPayment: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      ticket: {
        findUnique: jest.fn(),
      },
    };

    momoClient = {
      createPayment: jest.fn(),
      queryTransaction: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };

    jest
      .spyOn(
        MomoService.prototype as unknown as { createMomoClient: () => unknown },
        'createMomoClient',
      )
      .mockReturnValue(momoClient);

    service = new MomoService(
      configService as never,
      redisLockService as never,
      loggerService as never,
      prismaService as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates momo payment and upserts pending record', async () => {
    const momoResponse = {
      payUrl: 'https://momo.vn/pay-url',
      signature: 'signature-123',
    };

    prismaService.momoPayment.findUnique.mockResolvedValue(null);
    prismaService.ticket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      userId: 'user-1',
    });
    prismaService.momoPayment.upsert.mockResolvedValue({ id: 'payment-1' });
    momoClient.createPayment.mockResolvedValue(momoResponse);

    const result = await service.createMomoPayment('user-1', createDto);

    expect(result).toEqual(momoResponse);
    expect(redisLockService.runExclusive).toHaveBeenCalledWith(
      REDIS_LOCK_KEY.MOMO_PAYMENT('user-1', 'ticket-1'),
      REDIS_TTL.LOCK_SERVICE,
      expect.any(Function),
    );
    expect(momoClient.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 200000,
        orderId: 'ORDER-1',
        redirectUrl: 'https://api.example.com/momo/payment_result',
        ipnUrl: 'https://api.example.com/momo/momo_ipn',
        lang: 'vi',
        extraData: '',
      }),
    );
    expect(prismaService.momoPayment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ticketId: 'ticket-1' },
        create: expect.objectContaining({
          paymentStatus: PAYMENT_STATUS.PENDING,
          userId: 'user-1',
          ticketId: 'ticket-1',
          signature: 'signature-123',
        }),
        update: expect.objectContaining({
          paymentStatus: PAYMENT_STATUS.PENDING,
          userId: 'user-1',
          signature: 'signature-123',
        }),
      }),
    );
  });

  it('throws conflict when payment is already completed', async () => {
    prismaService.momoPayment.findUnique.mockResolvedValue({
      paymentStatus: PAYMENT_STATUS.COMPLETED,
    });

    await expect(
      service.createMomoPayment('user-1', createDto),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaService.ticket.findUnique).not.toHaveBeenCalled();
    expect(momoClient.createPayment).not.toHaveBeenCalled();
  });

  it('throws not found when ticket does not exist', async () => {
    prismaService.momoPayment.findUnique.mockResolvedValue(null);
    prismaService.ticket.findUnique.mockResolvedValue(null);

    await expect(
      service.createMomoPayment('user-1', createDto),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(momoClient.createPayment).not.toHaveBeenCalled();
    expect(prismaService.momoPayment.upsert).not.toHaveBeenCalled();
  });

  it('throws forbidden when ticket belongs to another user', async () => {
    prismaService.momoPayment.findUnique.mockResolvedValue(null);
    prismaService.ticket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      userId: 'user-2',
    });

    await expect(
      service.createMomoPayment('user-1', createDto),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(momoClient.createPayment).not.toHaveBeenCalled();
    expect(prismaService.momoPayment.upsert).not.toHaveBeenCalled();
  });

  it('throws conflict when lock cannot be acquired', async () => {
    redisLockService.runExclusive.mockResolvedValue(null);

    await expect(
      service.createMomoPayment('user-1', createDto),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(momoClient.createPayment).not.toHaveBeenCalled();
    expect(prismaService.momoPayment.upsert).not.toHaveBeenCalled();
  });

  it('propagates error when momo createPayment throws', async () => {
    prismaService.momoPayment.findUnique.mockResolvedValue(null);
    prismaService.ticket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      userId: 'user-1',
    });
    momoClient.createPayment.mockRejectedValue(new Error('momo down'));

    await expect(
      service.createMomoPayment('user-1', createDto),
    ).rejects.toThrow('momo down');

    expect(prismaService.momoPayment.upsert).not.toHaveBeenCalled();
  });

  it('propagates error when momo payment upsert throws', async () => {
    prismaService.momoPayment.findUnique.mockResolvedValue(null);
    prismaService.ticket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      userId: 'user-1',
    });
    momoClient.createPayment.mockResolvedValue({
      payUrl: 'https://momo.vn/pay-url',
      signature: 'signature-123',
    });
    prismaService.momoPayment.upsert.mockRejectedValue(new Error('db down'));

    await expect(
      service.createMomoPayment('user-1', createDto),
    ).rejects.toThrow('db down');
  });

  it('throws bad request when checking payment status without order id', async () => {
    await expect(service.checkMomoPaymentStatus('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('queries momo transaction by order id', async () => {
    const transaction = { orderId: 'ORDER-1', resultCode: 0 };
    momoClient.queryTransaction.mockResolvedValue(transaction);

    await expect(service.checkMomoPaymentStatus('ORDER-1')).resolves.toEqual(
      transaction,
    );
    expect(momoClient.queryTransaction).toHaveBeenCalledWith({
      orderId: 'ORDER-1',
    });
  });

  it('propagates query transaction error', async () => {
    momoClient.queryTransaction.mockRejectedValue(new Error('query timeout'));

    await expect(service.checkMomoPaymentStatus('ORDER-1')).rejects.toThrow(
      'query timeout',
    );
  });

  it('returns error response when ipn request does not exist', async () => {
    momoClient.verifyWebhookSignature.mockReturnValue(true);
    prismaService.momoPayment.findUnique.mockResolvedValue(null);

    const result = await service.momoIpnHandler(ipnDto);

    expect(result).toEqual(
      expect.objectContaining({
        requestId: 'req-1',
        orderId: 'ORDER-1',
        resultCode: 1,
        message: 'Request ID not found',
      }),
    );
  });

  it('returns already processed response when payment is completed', async () => {
    prismaService.momoPayment.findUnique.mockResolvedValue({
      requestId: 'req-1',
      orderId: 'ORDER-1',
      amount: 200000,
      paymentStatus: PAYMENT_STATUS.COMPLETED,
    });
    momoClient.verifyWebhookSignature.mockReturnValue(true);
    prismaService.momoPayment.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.momoIpnHandler(ipnDto);

    expect(result).toEqual(
      expect.objectContaining({
        resultCode: 0,
        message: 'Payment already processed',
      }),
    );
  });

  it('returns invalid signature response when signature check fails', async () => {
    momoClient.verifyWebhookSignature.mockReturnValue(false);

    const result = await service.momoIpnHandler(ipnDto);

    expect(momoClient.verifyWebhookSignature).toHaveBeenCalledWith(ipnDto);
    expect(result).toEqual(
      expect.objectContaining({
        resultCode: 1,
        message: 'Invalid signature',
      }),
    );
    expect(prismaService.momoPayment.findUnique).not.toHaveBeenCalled();
    expect(prismaService.momoPayment.updateMany).not.toHaveBeenCalled();
  });

  it('returns success response when ipn is valid and updates to COMPLETED', async () => {
    prismaService.momoPayment.findUnique.mockResolvedValue({
      requestId: 'req-1',
      orderId: 'ORDER-1',
      amount: 200000,
      paymentStatus: PAYMENT_STATUS.PENDING,
    });
    momoClient.verifyWebhookSignature.mockReturnValue(true);
    prismaService.momoPayment.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.momoIpnHandler(ipnDto);

    expect(prismaService.momoPayment.updateMany).toHaveBeenCalledWith({
      where: {
        requestId: 'req-1',
        paymentStatus: PAYMENT_STATUS.PENDING,
      },
      data: {
        paymentStatus: PAYMENT_STATUS.COMPLETED,
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        resultCode: 0,
        message: 'Payment processed successfully',
      }),
    );
  });

  it('updates payment status to FAILED when ipn resultCode is non-zero', async () => {
    prismaService.momoPayment.findUnique.mockResolvedValue({
      requestId: 'req-1',
      orderId: 'ORDER-1',
      amount: 200000,
      paymentStatus: PAYMENT_STATUS.PENDING,
    });
    momoClient.verifyWebhookSignature.mockReturnValue(true);
    prismaService.momoPayment.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.momoIpnHandler({
      ...ipnDto,
      resultCode: 49,
      message: 'Insufficient funds',
    });

    expect(prismaService.momoPayment.updateMany).toHaveBeenCalledWith({
      where: {
        requestId: 'req-1',
        paymentStatus: PAYMENT_STATUS.PENDING,
      },
      data: {
        paymentStatus: PAYMENT_STATUS.FAILED,
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        resultCode: 0,
        message: 'Payment processed successfully',
      }),
    );
  });

  it('returns payload mismatch when amount or orderId does not match', async () => {
    prismaService.momoPayment.findUnique.mockResolvedValue({
      requestId: 'req-1',
      orderId: 'ORDER-1',
      amount: 200000,
      paymentStatus: PAYMENT_STATUS.PENDING,
    });
    momoClient.verifyWebhookSignature.mockReturnValue(true);

    const result = await service.momoIpnHandler({
      ...ipnDto,
      amount: 300000,
    });

    expect(result).toEqual(
      expect.objectContaining({
        resultCode: 1,
        message: 'Payment payload mismatch',
      }),
    );
    expect(prismaService.momoPayment.updateMany).not.toHaveBeenCalled();
  });

  it('treats duplicate callback as idempotent when updateMany count is zero', async () => {
    prismaService.momoPayment.findUnique.mockResolvedValue({
      requestId: 'req-1',
      orderId: 'ORDER-1',
      amount: 200000,
      paymentStatus: PAYMENT_STATUS.FAILED,
    });
    momoClient.verifyWebhookSignature.mockReturnValue(true);
    prismaService.momoPayment.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.momoIpnHandler({
      ...ipnDto,
      resultCode: 49,
      message: 'Insufficient funds',
    });

    expect(result).toEqual(
      expect.objectContaining({
        resultCode: 0,
        message: 'Payment processed successfully',
      }),
    );
  });

  it('rejects whitespace-only orderId after trim', async () => {
    await expect(service.checkMomoPaymentStatus('   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
