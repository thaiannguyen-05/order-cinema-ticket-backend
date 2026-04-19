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

export type Payload = {
  id: string;
  email: string;
};
