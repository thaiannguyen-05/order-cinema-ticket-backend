import { SEAT_STATUS } from '@prisma/client';

export type CreateSeatDto = {
  row: number;
  column: number;
  status?: SEAT_STATUS;
  filmId: string;
  cinemaId: number;
};
