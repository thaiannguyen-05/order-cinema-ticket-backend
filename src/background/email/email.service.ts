import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendUserConfirmation(email: string, token: string) {
    const url = `${this.configService.get('BASE_URL')}${this.configService.get('SENDING_VERIFY_EMAIL')}?token=${token}`;

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
  }

  async sendResetPasswordEmail(email: string, token: string) {
    const url = `${this.configService.get('BASE_URL')}${this.configService.get('SENDING_RESET_PASSWORD_EMAIL')}?token=${token}`;

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
  }
}
