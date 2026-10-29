import { Inject, Injectable, Optional } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { MetricsService } from '../metrics/metrics.service';
import { EVENT_NAME, QUEUE_NAME } from './constant/event.constant';

@Injectable()
export class EmailWorker {
  constructor(
    @Inject(QUEUE_NAME.GMAIL_SERVICE) private readonly client: ClientProxy,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  sendVerifyCode(email: string, code: string) {
    try {
      this.client.emit(EVENT_NAME.SEND_VERIFY_CODE, { email, code });
      this.metrics?.incEmailPublished('verify', 'ok');
    } catch {
      this.metrics?.incEmailPublished('verify', 'fail');
    }
  }

  sendResetPasswordEmail(email: string, token: string) {
    try {
      this.client.emit(EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL, { email, token });
      this.metrics?.incEmailPublished('reset', 'ok');
    } catch {
      this.metrics?.incEmailPublished('reset', 'fail');
    }
  }
}
