import { AccountStatus } from '@prisma/client';

export type CreateUserDto = {
  fullname: string;
  email: string;
  password: string;
  dateOfBirth: Date;
  address: string;
  status?: AccountStatus;
};
