import { SEAT_STATUS } from '@prisma/client';

export type FindSeatDto = {
  filmId?: string;
  cinemaId?: number;
  status?: SEAT_STATUS;
  limit?: number;
  page?: number;
  cursor?: string;
};
