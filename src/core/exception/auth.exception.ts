import { UnauthorizedException } from '@nestjs/common';

export type InvalidCredentialsReason =
  | 'USER_NOT_FOUND'
  | 'INACTIVE_USER'
  | 'INVALID_PASSWORD';

export type InvalidRefreshTokenReason =
  | 'MISSING_SESSION_ID'
  | 'SESSION_NOT_FOUND'
  | 'MISSING_TOKEN'
  | 'INVALID_TOKEN'
  | 'USER_MISMATCH'
  | 'USER_NOT_FOUND';

/**
 * Public AuthenticationFailure for login: one fixed message for all
 * internal causes to prevent user enumeration. Internal reason travels
 * as `cause` and is never serialized by ErrorException.
 */
export class InvalidCredentialsException extends UnauthorizedException {
  readonly reason?: InvalidCredentialsReason;

  constructor(reason?: InvalidCredentialsReason) {
    super('Invalid email or password');
    this.reason = reason;
    if (reason) {
      (this as { cause?: unknown }).cause = reason;
    }
  }
}

/**
 * Public AuthenticationFailure for refresh: one fixed message for all
 * internal causes. Internal reason travels as `cause`, never exposed.
 */
export class InvalidRefreshTokenException extends UnauthorizedException {
  readonly reason?: InvalidRefreshTokenReason;

  constructor(reason?: InvalidRefreshTokenReason) {
    super('Invalid refresh token');
    this.reason = reason;
    if (reason) {
      (this as { cause?: unknown }).cause = reason;
    }
  }
}
