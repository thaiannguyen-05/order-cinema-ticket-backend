import { Controller, Optional } from '@nestjs/common';
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

  private isValidEmailPayload(
    data: unknown,
  ): data is { email: string; code: string } {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    return (
      typeof d.email === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) &&
      typeof d.code === 'string' &&
      d.code.length >= 4 &&
      d.code.length <= 64
    );
  }

  private isValidTokenPayload(
    data: unknown,
  ): data is { email: string; token: string } {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    return (
      typeof d.email === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) &&
      typeof d.token === 'string' &&
      d.token.length >= 4 &&
      d.token.length <= 512
    );
  }

  @MessagePattern(EVENT_NAME.SEND_VERIFY_CODE)
  async sendVerifyCode(
    @Payload() data: { email: string; code: string },
    @Ctx() context: RmqContext,
  ) {
    const message: unknown = context.getMessage();
    const channel = context.getChannelRef() as RmqAckChannel;
    const start = process.hrtime.bigint();

    // Drop malformed/spoofed payloads without requeue (no DLQ yet, no poison loop).
    if (!this.isValidEmailPayload(data)) {
      channel.ack(message);
      this.metrics?.incEmailConsumed('verify', 'ack');
      return;
    }

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
      // No requeue: poison/SMTP failures must not loop forever. Drop and alert
      // via metrics; DLQ wiring to be added with broker ACLs.
      channel.nack(message, false, false);
      this.metrics?.incEmailConsumed('verify', 'nack');
      this.metrics?.observeEmail(
        'verify',
        'nack',
        Number(process.hrtime.bigint() - start) / 1e9,
      );
      return;
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

    if (!this.isValidTokenPayload(data)) {
      channel.ack(message);
      this.metrics?.incEmailConsumed('reset', 'ack');
      return;
    }

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
      channel.nack(message, false, false);
      this.metrics?.incEmailConsumed('reset', 'nack');
      this.metrics?.observeEmail(
        'reset',
        'nack',
        Number(process.hrtime.bigint() - start) / 1e9,
      );
      return;
    }
  }
}
