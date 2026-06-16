import type { JsonValue } from '@prisma/client/runtime/client';

export interface FilmDetail {
  filmName: string;
  filmGenres: string[] | null;
  filmCast: string[] | null;
  filmDirectors: string[] | null;
  filmProducers: string[] | null;
  filmWriters: string[] | null;
  filmDistributor: string | null;
  filmOtherTitle: JsonValue | null;
  filmAgeRating: JsonValue | null;
  filmSynopsis: string | null;
  filmDurationMins: number;
  filmReviewStars: number;
  filmReviewTxt: string | null;
}

export interface OrderDetail {
  orderId: string;
  ticketCode: string;
  ticketPrice: number;
  film: FilmDetail;
  cinemaName: string;
  cinemaCity: string;
  seatRow: number;
  seatColumn: number;
  paymentAmount: number | null;
  paymentStatus: string | null;
  orderStatus: string;
  createdAt: Date;
}

export interface UserOrderFrequentData {
  userId: string;
  userFullname: string;
  userEmail: string;
  totalOrders: number;
  totalSpent: number;
  avgTicketPrice: number;
  topFilms: Array<{
    filmName: string;
    filmGenres: string[] | null;
    orderCount: number;
  }>;
  topCinemas: Array<{
    cinemaName: string;
    cinemaCity: string;
    orderCount: number;
  }>;
  orderStatusBreakdown: Array<{ status: string; count: number }>;
  firstOrder: Date;
  lastOrder: Date;
  orders: OrderDetail[];
}

export interface TrackingFrequentResult {
  users: UserOrderFrequentData[];
  totalCount: number;
}
