import { Controller, ServiceUnavailableException } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { EVENT_NAME } from './constant/event.type';
import { EmailService } from './email.service';

type RmqAckChannel = {
  ack: (message: unknown) => void;
  nack: (message: unknown, allUpTo?: boolean, requeue?: boolean) => void;
};

@Controller()
export class EmailConsumer {
  constructor(private readonly emailService: EmailService) {}

  @MessagePattern(EVENT_NAME.SEND_VERIFY_CODE)
  async sendVerifyCode(
    @Payload() data: { email: string; code: string },
    @Ctx() context: RmqContext,
  ) {
    const message: unknown = context.getMessage();
    const channel = context.getChannelRef() as RmqAckChannel;

    try {
      await this.emailService.sendUserConfirmation(data.email, data.code);
      channel.ack(message);
    } catch {
      channel.nack(message, false, true);
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

    try {
      await this.emailService.sendResetPasswordEmail(data.email, data.token);
      channel.ack(message);
    } catch {
      channel.nack(message, false, true);
      throw new ServiceUnavailableException(
        'Email service temporarily unavailable',
      );
    }
  }
}
