import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply } from 'fastify';
import type { AuthCookiePayload } from './type';

export const AUTH_COOKIE_NAME = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  SESSION_ID: 'sessionId',
} as const;

export const COOKIE_TTL = {
  ACCESS_TOKEN: 15 * 60, // 15 minutes in seconds
  REFRESH_TOKEN: 7 * 24 * 60 * 60, // 7 days in seconds
  COOKIE_TTL: 7 * 24 * 60 * 60, // 7 days in seconds
} as const;

export const getAuthCookieOptions = (
  isProduction: boolean,
): CookieSerializeOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: COOKIE_TTL.COOKIE_TTL, // seconds for @fastify/cookie
});

export const setAuthCookies = (
  reply: FastifyReply,
  cookies: AuthCookiePayload,
  isProduction: boolean,
): void => {
  const options = getAuthCookieOptions(isProduction);

  if (cookies.refreshToken) {
    reply.setCookie(
      AUTH_COOKIE_NAME.REFRESH_TOKEN,
      cookies.refreshToken,
      options,
    );
  }

  if (cookies.accessToken) {
    reply.setCookie(
      AUTH_COOKIE_NAME.ACCESS_TOKEN,
      cookies.accessToken,
      options,
    );
  }

  if (cookies.sessionId) {
    reply.setCookie(AUTH_COOKIE_NAME.SESSION_ID, cookies.sessionId, options);
  }
};

export const clearAuthCookies = (reply: FastifyReply): void => {
  const options: CookieSerializeOptions = { path: '/' };

  reply.clearCookie(AUTH_COOKIE_NAME.ACCESS_TOKEN, options);
  reply.clearCookie(AUTH_COOKIE_NAME.REFRESH_TOKEN, options);
  reply.clearCookie(AUTH_COOKIE_NAME.SESSION_ID, options);
};
