import type { JwtPayload } from '../../../../core';

export type UserWithoutPassword = {
  id: string;
  fullname: string;
  email: string;
  address: string;
  dateOfBirth: Date;
};

export type UserGenerateTokens = Omit<Required<JwtPayload>, 'typ'>;

export type AuthCookiePayload = {
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
};
