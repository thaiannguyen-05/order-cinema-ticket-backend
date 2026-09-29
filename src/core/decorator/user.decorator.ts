import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../type/type';
import { Request } from 'express';
export const User = createParamDecorator(
  (data: keyof JwtPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();
    const payload = request.payload;

    if (data) {
      return payload?.[data];
    }
    return payload;
  },
);
