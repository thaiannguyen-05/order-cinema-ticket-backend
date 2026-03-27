import { MomoClient, MomoClientConfig } from '@andev2005/momo-sdk';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_STATUS } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../background/prisma/prisma.service';
import { RedisLockService } from '../../../background/redis/redis.lock.service';
import {
  REDIS_LOCK_KEY,
  REDIS_TTL,
} from '../../../background/redis/redis.value';
import { MyLogger } from '../../../core/logger/logger.service';
import { CreateMomoPaymentDto } from './dto/create.momoPayment';
import { MomoIPNHandler, MomoIPNResponse } from './dto/momo-ipn.handler';
@Injectable()
export class MomoService {
  private readonly momoClient: MomoClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisLockService: RedisLockService,
    private readonly loggerService: MyLogger,
    private readonly prismaService: PrismaService,
  ) {
    this.momoClient = this.createMomoClient();
  }

  private createMomoConfig(): MomoClientConfig {
    return {
      accessKey: this.configService.getOrThrow<string>('MOMO_ACCESS_KEY'),
      partnerCode: this.configService.getOrThrow<string>('MOMO_PARTNER_CODE'),
      secretKey: this.configService.getOrThrow<string>('MOMO_SECRET_KEY'),
      env: this.configService.getOrThrow<string>('MOMO_ENV') as
        | 'production'
        | undefined,
      baseUrl: this.configService.getOrThrow<string>('MOMO_BASE_URL'),
      timeoutMs: this.configService.getOrThrow<number>('MOMO_TIMEOUT_MS'),
    };
  }

  createMomoClient() {
    const config = this.createMomoConfig();
    return new MomoClient(config);
  }

  async createMomoPayment(userId: string, dto: CreateMomoPaymentDto) {
    const lockKey = REDIS_LOCK_KEY.MOMO_PAYMENT(userId, dto.ticketId);

    const result = await this.redisLockService.runExclusive(
      lockKey,
      REDIS_TTL.LOCK_SERVICE,
      async () => {
        const existingPayment = await this.prismaService.momoPayment.findUnique(
          {
            where: { ticketId: dto.ticketId },
            select: { paymentStatus: true },
          },
        );

        if (existingPayment?.paymentStatus === PAYMENT_STATUS.COMPLETED) {
          throw new ConflictException('This ticket has already been paid');
        }

        const ticket = await this.prismaService.ticket.findUnique({
          where: { id: dto.ticketId },
          select: { id: true, userId: true },
        });

        if (!ticket) {
          throw new NotFoundException('Ticket not found');
        }

        if (ticket.userId !== userId) {
          throw new ForbiddenException('Ticket does not belong to this user');
        }

        const requestId = randomUUID();
        const partnerCode =
          this.configService.getOrThrow<string>('MOMO_PARTNER_CODE');
        const partnerName = this.configService.get<string>('MOMO_PARTNER_NAME');
        const storeId = this.configService.get<string>('MOMO_STORE_ID');
        const baseUrl = this.configService.getOrThrow<string>('BASE_URL');
        const redirectUrl = this.configService.get<string>(
          'MOMO_REDIRECT_URL',
          `${baseUrl}/momo/payment_result`,
        );
        const ipnUrl = this.configService.get<string>(
          'MOMO_IPN_URL',
          `${baseUrl}/momo/momo_ipn`,
        );
        const requestType = 'captureWallet' as const;
        const autoCapture = true;
        const lang = dto.lang ?? 'vi';
        const extraData = dto.extraData ?? '';

        const momoResponse = await this.momoClient.createPayment({
          amount: dto.amount,
          orderId: dto.orderId,
          orderInfo: dto.orderInfo,
          redirectUrl,
          ipnUrl,
          autoCapture,
          lang,
          extraData,
          requestType,
          requestId,
        });

        await this.prismaService.momoPayment.upsert({
          where: { ticketId: dto.ticketId },
          create: {
            requestId,
            partnerCode,
            partnerName,
            storeId,
            amount: dto.amount,
            orderId: dto.orderId,
            orderInfo: dto.orderInfo,
            autoCapture,
            redirectUrl,
            ipnUrl,
            requestType,
            extraData,
            lang,
            signature: String(momoResponse.signature ?? ''),
            userId: userId,
            ticketId: dto.ticketId,
            paymentStatus: PAYMENT_STATUS.PENDING,
          },
          update: {
            requestId,
            partnerCode,
            partnerName,
            storeId,
            amount: dto.amount,
            orderId: dto.orderId,
            orderInfo: dto.orderInfo,
            autoCapture,
            redirectUrl,
            ipnUrl,
            requestType,
            extraData,
            lang,
            signature: String(momoResponse.signature ?? ''),
            userId: userId,
            paymentStatus: PAYMENT_STATUS.PENDING,
          },
        });

        return momoResponse;
      },
    );

    if (!result) {
      throw new ConflictException('Payment request is being processed');
    }

    return result;
  }

  async checkMomoPaymentStatus(orderId: string) {
    if (!orderId) {
      throw new BadRequestException('orderId is required');
    }

    return await this.momoClient.queryTransaction({ orderId: orderId });
  }

  async momoIpnHandler(dto: MomoIPNHandler) {
    this.loggerService.debug(`Received Momo IPN: ${JSON.stringify(dto)}`);

    const isAvailableRequest = await this.prismaService.momoPayment.findUnique({
      where: { requestId: dto.requestId },
    });

    if (!isAvailableRequest) {
      this.loggerService.debug(
        `Momo IPN requestId ${dto.requestId} not found in database`,
      );
      return {
        partnerCode: dto.partnerCode,
        requestId: dto.requestId,
        orderId: dto.orderId,
        resultCode: 1,
        message: 'Request ID not found',
        responseTime: Date.now(),
        extraData: dto.extraData,
        signature: '',
      } as MomoIPNResponse;
    }

    if (isAvailableRequest.paymentStatus === 'COMPLETED') {
      this.loggerService.debug(
        `Momo IPN requestId ${dto.requestId} has already been processed`,
      );
      return {
        partnerCode: dto.partnerCode,
        requestId: dto.requestId,
        orderId: dto.orderId,
        resultCode: 0,
        message: 'Payment already processed',
        responseTime: Date.now(),
        extraData: dto.extraData,
        signature: '',
      } as MomoIPNResponse;
    }

    const isValiedSignature = this.momoClient.verifyWebhookSignature(dto);

    if (!isValiedSignature) {
      this.loggerService.debug(
        `Invalid signature for Momo IPN requestId ${dto.requestId}`,
      );
      return {
        partnerCode: dto.partnerCode,
        requestId: dto.requestId,
        orderId: dto.orderId,
        resultCode: 1,
        message: 'Invalid signature',
        responseTime: Date.now(),
        extraData: dto.extraData,
        signature: '',
      } as MomoIPNResponse;
    }

    return {
      partnerCode: dto.partnerCode,
      requestId: dto.requestId,
      orderId: dto.orderId,
      resultCode: 0,
      message: 'Payment processed successfully',
      responseTime: Date.now(),
      extraData: dto.extraData,
      signature: '',
    };
  }
}
