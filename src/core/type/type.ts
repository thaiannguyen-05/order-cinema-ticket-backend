import type { USER_ROLE } from '@prisma/client';

export type ResponseMapping<T> = {
  success: true;
  code: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
};

export type ExceptionResponseMapping = {
  success: false;
  code: number;
  message: string;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
};

export type JwtPayload = {
  id: string;
  email: string;
  role: USER_ROLE;
};

export type RmqAckChannel = {
  ack: (message: unknown) => void;
  nack: (message: unknown, allUpTo?: boolean, requeue?: boolean) => void;
};

export type ClosableAmqpConnection = {
  close: () => Promise<void>;
};
