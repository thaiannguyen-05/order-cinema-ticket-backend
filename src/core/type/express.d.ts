import 'express';
import type { JwtPayload } from './type';

declare module 'express' {
  interface Request {
    requestId?: string;
    payload?: JwtPayload;
  }
}
