import { Payload } from '../../../../core';

export type UserWithoutPassword = {
  id: string;
  fullname: string;
  email: string;
  address: string;
  dateOfBirth: Date;
};

export type UserGenerateTokens = Required<Payload>;

export const COOKIE_TTL = {
  ACCESS_TOKEN: 15 * 60, // 15 minutes
  REFRESH_TOKEN: 7 * 24 * 60 * 60, // 7 days
  COOKIE_TTL: 7 * 24 * 60 * 60, // 7 days
};
