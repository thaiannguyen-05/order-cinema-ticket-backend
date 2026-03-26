import { Payload } from '../../../../core';

export type UserWithoutPassword = {
  id: string;
  fullname: string;
  email: string;
  address: string;
  dateOfBirth: Date;
};

export type UserGenerateTokens = Required<Payload>;
