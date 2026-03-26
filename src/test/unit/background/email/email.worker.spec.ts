import { EmailWorker } from '../../../../background/email/email.worker';
import { EVENT_NAME } from '../../../../background/email/constant/event.type';

describe('EmailWorker', () => {
  it('emits verify and reset events', () => {
    const client = { emit: jest.fn() };
    const worker = new EmailWorker(client as never);

    worker.sendVerifyCode('a@example.com', '123456');
    worker.sendResetPasswordEmail('a@example.com', 'token-1');

    expect(client.emit).toHaveBeenNthCalledWith(
      1,
      EVENT_NAME.SEND_VERIFY_CODE,
      {
        email: 'a@example.com',
        code: '123456',
      },
    );
    expect(client.emit).toHaveBeenNthCalledWith(
      2,
      EVENT_NAME.SEND_FORGOT_PASSWORD_EMAIL,
      {
        email: 'a@example.com',
        token: 'token-1',
      },
    );
  });
});
