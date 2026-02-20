import { AccountStatus } from '@prisma/client';
import { CreateUserDto } from './create.user.dto';

export type UpdateUser = Pick<CreateUserDto, 'email'> &
  Partial<Omit<CreateUserDto, 'email' | 'status'>> & {
    status?: AccountStatus;
  };
