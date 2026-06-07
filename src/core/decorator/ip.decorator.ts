import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const ClientIp = createParamDecorator((ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.ips?.length ? req.ips[0] : req.ip;
});
