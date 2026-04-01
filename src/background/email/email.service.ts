import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RETRY_VALUES,
  retryCore,
  RetryCoreOptions,
} from '../../core/interfaces/re-try.interface';

@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  private readonly optionsRetry: RetryCoreOptions = {
    maxRetryTimes: RETRY_VALUES.MAX_RETRY_TIMES,
    backoffMultiplier: RETRY_VALUES.BACKOFF_MUL,
    baseDelayMs: RETRY_VALUES.BASE_DELAY_MS,
    maxDelayMs: RETRY_VALUES.MAX_DELAY_MS,
  };

  async sendUserConfirmation(email: string, token: string) {
    const url = `${this.configService.get('BASE_URL')}${this.configService.get('SENDING_VERIFY_EMAIL')}?token=${token}`;
    await retryCore(async () => {
      try {
        await this.mailerService.sendMail({
          to: email,
          subject: 'Welcome to Nice App! Confirm your Email',
          template: './verification-code',
          context: {
            url,
            token,
            email,
          },
        });
      } catch {
        throw new ServiceUnavailableException(
          'Email service is temporarily unavailable',
        );
      }
    }, this.optionsRetry);
  }

  async sendResetPasswordEmail(email: string, token: string) {
    const url = `${this.configService.get('BASE_URL')}${this.configService.get('SENDING_RESET_PASSWORD_EMAIL')}?token=${token}`;
    await retryCore(async () => {
      try {
        await this.mailerService.sendMail({
          to: email,
          subject: 'Reset your password',
          template: './reset-password',
          context: {
            url,
            token,
            email,
          },
        });
      } catch {
        throw new ServiceUnavailableException(
          'Email service is temporarily unavailable',
        );
      }
    }, this.optionsRetry);
  }
}
