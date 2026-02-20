import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { EVENT_NAME, QUEUE_NAME } from './constant/event.type';

@Injectable()
export class EmailWorker {
  constructor(
    @Inject(QUEUE_NAME.GMAIL_SERVICE) private readonly client: ClientProxy,
  ) {}

  sendVerifyCode(email: string, code: string) {
    this.client.emit(EVENT_NAME.SEND_VERIFY_CODE, { email, code });
  }

  sendResetPasswordEmail(email: string, token: string) {
    this.client.emit(EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL, { email, token });
  }
}
