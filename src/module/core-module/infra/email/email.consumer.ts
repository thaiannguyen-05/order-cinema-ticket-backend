import {
  Controller,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { MetricsService } from '../metrics/metrics.service';
import { EVENT_NAME } from './constant/event.constant';
import { EmailService } from './email.service';
import type { RmqAckChannel } from '../../../../core/type/type';

@Controller()
export class EmailConsumer {
  constructor(
    private readonly emailService: EmailService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  @MessagePattern(EVENT_NAME.SEND_VERIFY_CODE)
  async sendVerifyCode(
    @Payload() data: { email: string; code: string },
    @Ctx() context: RmqContext,
  ) {
    const message: unknown = context.getMessage();
    const channel = context.getChannelRef() as RmqAckChannel;
    const start = process.hrtime.bigint();

    try {
      await this.emailService.sendUserConfirmation(data.email, data.code);
      channel.ack(message);
      this.metrics?.incEmailConsumed('verify', 'ack');
      this.metrics?.observeEmail(
        'verify',
        'ack',
        Number(process.hrtime.bigint() - start) / 1e9,
      );
    } catch {
      channel.nack(message, false, true);
      this.metrics?.incEmailConsumed('verify', 'nack');
      this.metrics?.observeEmail(
        'verify',
        'nack',
        Number(process.hrtime.bigint() - start) / 1e9,
      );
      throw new ServiceUnavailableException(
        'Email service temporarily unavailable',
      );
    }
  }

  @MessagePattern(EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL)
  async sendResetPasswordEmail(
    @Payload() data: { email: string; token: string },
    @Ctx() context: RmqContext,
  ) {
    const message: unknown = context.getMessage();
    const channel = context.getChannelRef() as RmqAckChannel;
    const start = process.hrtime.bigint();

    try {
      await this.emailService.sendResetPasswordEmail(data.email, data.token);
      channel.ack(message);
      this.metrics?.incEmailConsumed('reset', 'ack');
      this.metrics?.observeEmail(
        'reset',
        'ack',
        Number(process.hrtime.bigint() - start) / 1e9,
      );
    } catch {
      channel.nack(message, false, true);
      this.metrics?.incEmailConsumed('reset', 'nack');
      this.metrics?.observeEmail(
        'reset',
        'nack',
        Number(process.hrtime.bigint() - start) / 1e9,
      );
      throw new ServiceUnavailableException(
        'Email service temporarily unavailable',
      );
    }
  }
}
