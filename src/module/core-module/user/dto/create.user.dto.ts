import { ACCOUNT_STATUS } from '@prisma/client';

export type CreateUserDto = {
  fullname: string;
  email: string;
  password: string;
  dateOfBirth: Date;
  address: string;
  status?: ACCOUNT_STATUS;
};
