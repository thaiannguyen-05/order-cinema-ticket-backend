import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { JwtPayload } from '../type/type';

export const User = createParamDecorator(
  (data: keyof JwtPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const payload = request.payload;

    if (data) {
      return payload?.[data];
    }
    return payload;
  },
);
