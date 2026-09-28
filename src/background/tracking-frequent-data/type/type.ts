import type { JsonValue } from '@prisma/client/runtime/client';

export type FrequentOrderWithRelations = {
  id: string;
  userId: string;
  status: string;
  createdAt: Date;
  user: { id: string; fullname: string; email: string };
  ticket: {
    code: string;
    price: number;
    filmOfCinema: {
      film: {
        film_name: string;
        genres: JsonValue | null;
        cast: JsonValue | null;
        directors: JsonValue | null;
        producers: JsonValue | null;
        writers: JsonValue | null;
        distributor: string | null;
        other_title: JsonValue | null;
        age_rating: JsonValue | null;
        synopsis_long: string | null;
        duration_mins: number;
        review_stars: number;
        review_txt: string | null;
      };
      cinema: { cinema_name: string; city: string };
    };
    seat: { row: number; column: number };
  };
  payment: { amount: number; orderStatus: string } | null;
};
