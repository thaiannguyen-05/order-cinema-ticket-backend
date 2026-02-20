import { MailerService } from '@nestjs-modules/mailer';
import { BadRequestException, Injectable } from '@nestjs/common';
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
    } catch (error) {
      throw new BadRequestException(`Failed to send email: ${error}`);
    }
  }
}
