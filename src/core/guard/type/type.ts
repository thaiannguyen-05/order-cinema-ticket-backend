import type { Request } from 'express';

export type RequestWithAccessTokenCookie = Request & {
  cookies?: {
    accessToken?: string;
  };
};
