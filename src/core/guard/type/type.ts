import type { FastifyRequest } from 'fastify';

export type RequestWithAccessTokenCookie = FastifyRequest & {
  cookies: FastifyRequest['cookies'] & {
    accessToken?: string;
  };
};
