import { MomoClient, MomoClientConfig } from '@andev2005/momo-sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../background/prisma/prisma.service';
import { RedisLockService } from '../../../background/redis/redis.lock.service';
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

  async createMomoPayment(dto: CreateMomoPaymentDto) {
    return await this.momoClient.createPayment({
      amount: dto.amount,
      orderId: dto.orderId,
      orderInfo: dto.orderInfo,
      redirectUrl: dto.redirectUrl,
      ipnUrl: dto.ipnUrl,
      autoCapture: dto.autoCapture,
      lang: dto.lang,
      extraData: dto.extraData,
      requestType: dto.requestType,
      requestId: dto.requestId,
    });
  }

  async checkMomoPaymentStatus(orderId: string) {
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
