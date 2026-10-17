import type { JwtPayload } from './type';

declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string;
    payload?: JwtPayload;
  }
}
