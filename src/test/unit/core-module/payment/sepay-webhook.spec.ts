import { UnauthorizedException } from '@nestjs/common';
import { assertSepayWebhookSecret } from '../../../../module/core-module/payment/sepay.service';

describe('assertSepayWebhookSecret (fail-closed webhook auth)', () => {
  it('accepts the correct header', () => {
    expect(() => assertSepayWebhookSecret('s3cret', 's3cret')).not.toThrow();
  });

  it('rejects when secret is missing (never fail open)', () => {
    expect(() => assertSepayWebhookSecret(undefined, 'x')).toThrow(
      UnauthorizedException,
    );
    expect(() => assertSepayWebhookSecret('', 'x')).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects placeholder secret', () => {
    expect(() => assertSepayWebhookSecret('REPLACE_ME', 'REPLACE_ME')).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects missing or wrong header', () => {
    expect(() => assertSepayWebhookSecret('s3cret', undefined)).toThrow(
      UnauthorizedException,
    );
    expect(() => assertSepayWebhookSecret('s3cret', 'wrong')).toThrow(
      UnauthorizedException,
    );
  });
});
