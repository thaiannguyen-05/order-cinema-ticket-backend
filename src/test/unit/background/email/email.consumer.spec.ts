import { EmailConsumer } from '../../../../background/email/email.consumer';

describe('EmailConsumer', () => {
  it('delegates queue handlers to email service', async () => {
    const emailService = {
      sendUserConfirmation: jest.fn().mockResolvedValue(undefined),
      sendResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
    };

    const consumer = new EmailConsumer(emailService as never);
    const rmqContext = {
      getMessage: jest.fn().mockReturnValue({}),
      getChannelRef: jest.fn().mockReturnValue({
        ack: jest.fn(),
        nack: jest.fn(),
      }),
    };

    await consumer.sendVerifyCode(
      { email: 'a@example.com', code: '123456' },
      rmqContext as never,
    );
    await consumer.sendResetPasswordEmail(
      {
        email: 'a@example.com',
        token: 'token-1',
      },
      rmqContext as never,
    );

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
