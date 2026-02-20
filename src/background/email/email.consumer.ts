import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EVENT_NAME } from './constant/event.type';
import { EmailService } from './email.service';

@Controller()
export class EmailConsumer {
  constructor(private readonly emailService: EmailService) {}

  @MessagePattern(EVENT_NAME.SEND_VERIFY_CODE)
  async sendVerifyCode(@Payload() data: { email: string; code: string }) {
    await this.emailService.sendUserConfirmation(data.email, data.code);
  }

  @MessagePattern(EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL)
  async sendResetPasswordEmail(
    @Payload() data: { email: string; token: string },
  ) {
    await this.emailService.sendResetPasswordEmail(data.email, data.token);
  }
}
