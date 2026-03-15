import { BadRequestException } from '@nestjs/common';
import { EmailService } from '../../../../background/email/email.service';

describe('EmailService', () => {
  let service: EmailService;
  let mailerService: { sendMail: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    mailerService = { sendMail: jest.fn() };
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          BASE_URL: 'https://api.example.com',
          SENDING_VERIFY_EMAIL: '/verify',
          SENDING_RESET_PASSWORD_EMAIL: '/reset',
        };
        return map[key];
      }),
    };

    service = new EmailService(mailerService as never, configService as never);
  });

  it('sends confirmation email', async () => {
    mailerService.sendMail.mockResolvedValue(undefined);

    await service.sendUserConfirmation('a@example.com', '123456');

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@example.com',
        template: './verification-code',
        context: expect.objectContaining({ url: 'https://api.example.com/verify?token=123456' }),
      }),
    );
  });

  it('sends reset password email', async () => {
    mailerService.sendMail.mockResolvedValue(undefined);

    await service.sendResetPasswordEmail('a@example.com', 'token-1');

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@example.com',
        template: './reset-password',
        context: expect.objectContaining({ url: 'https://api.example.com/reset?token=token-1' }),
      }),
    );
  });

  it('throws bad request when mailer fails', async () => {
    mailerService.sendMail.mockRejectedValue(new Error('smtp down'));

    await expect(service.sendUserConfirmation('a@example.com', '123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
