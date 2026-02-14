import 'express';
import { Payload } from './type';

declare module 'express' {
  interface Request {
    requestId?: string;
    payload?: Payload;
  }
}
