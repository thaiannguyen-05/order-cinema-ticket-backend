import type { Response, CookieOptions } from 'express';
import { COOKIE_TTL } from './type';

export const AUTH_COOKIE_NAME = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  SESSION_ID: 'sessionId',
} as const;

export type AuthCookiePayload = {
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
};

export const getAuthCookieOptions = (isProduction: boolean): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: COOKIE_TTL.COOKIE_TTL * 1000, // 7 days in milliseconds
});

export const setAuthCookies = (
  response: Response,
  cookies: AuthCookiePayload,
  isProduction: boolean,
): void => {
  const options = getAuthCookieOptions(isProduction);

  if (cookies.refreshToken) {
    response.cookie(
      AUTH_COOKIE_NAME.REFRESH_TOKEN,
      cookies.refreshToken,
      options,
    );
  }

  if (cookies.accessToken) {
    response.cookie(
      AUTH_COOKIE_NAME.ACCESS_TOKEN,
      cookies.accessToken,
      options,
    );
  }

  if (cookies.sessionId) {
    response.cookie(AUTH_COOKIE_NAME.SESSION_ID, cookies.sessionId, options);
  }
};

export const clearAuthCookies = (response: Response): void => {
  const options: CookieOptions = { path: '/' };

  response.clearCookie(AUTH_COOKIE_NAME.ACCESS_TOKEN, options);
  response.clearCookie(AUTH_COOKIE_NAME.REFRESH_TOKEN, options);
  response.clearCookie(AUTH_COOKIE_NAME.SESSION_ID, options);
};
