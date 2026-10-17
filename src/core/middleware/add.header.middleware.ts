import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Injectable()
export class AddHeaderMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    const raw = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(raw) ? raw[0] : raw)?.toString() ?? randomUUID();
    req.requestId = requestId;
    res.header('X-Request-Id', requestId);
    next();
  }
}
