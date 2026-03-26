import { EmailConsumer } from '../../../../background/email/email.consumer';

describe('EmailConsumer', () => {
  it('delegates queue handlers to email service', async () => {
    const emailService = {
      sendUserConfirmation: jest.fn().mockResolvedValue(undefined),
      sendResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
    };

    const consumer = new EmailConsumer(emailService as never);

    await consumer.sendVerifyCode({ email: 'a@example.com', code: '123456' });
    await consumer.sendResetPasswordEmail({
      email: 'a@example.com',
      token: 'token-1',
    });

    expect(emailService.sendUserConfirmation).toHaveBeenCalledWith(
      'a@example.com',
      '123456',
    );
    expect(emailService.sendResetPasswordEmail).toHaveBeenCalledWith(
      'a@example.com',
      'token-1',
    );
  });
});
