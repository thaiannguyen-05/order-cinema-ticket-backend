import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderDetail,
  UserOrderFrequentData,
  TrackingFrequentResult,
} from './dto/frequent-data.dto';
import type { FrequentOrderWithRelations } from './type/type';

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function parseStringArray(value: unknown): string[] | null {
  return isStringArray(value) ? value : null;
}

const ORDER_INCLUDE = {
  user: {
    select: { id: true, fullname: true, email: true },
  },
  ticket: {
    include: {
      filmOfCinema: {
        include: {
          film: {
            select: {
              film_name: true,
              genres: true,
              cast: true,
              directors: true,
              producers: true,
              writers: true,
              distributor: true,
              other_title: true,
              age_rating: true,
              synopsis_long: true,
              duration_mins: true,
              review_stars: true,
              review_txt: true,
            },
          },
          cinema: {
            select: { cinema_name: true, city: true },
          },
        },
      },
      seat: {
        select: { row: true, column: true },
      },
    },
  },
} as const;

function buildOrderDetail(o: FrequentOrderWithRelations): OrderDetail {
  const f = o.ticket.filmOfCinema.film;
  return {
    orderId: o.id,
    ticketCode: o.ticket.code,
    ticketPrice: o.ticket.price,
    film: {
      filmName: f.film_name,
      filmGenres: parseStringArray(f.genres),
      filmCast: parseStringArray(f.cast),
      filmDirectors: parseStringArray(f.directors),
      filmProducers: parseStringArray(f.producers),
      filmWriters: parseStringArray(f.writers),
      filmDistributor: f.distributor,
      filmOtherTitle: f.other_title,
      filmAgeRating: f.age_rating,
      filmSynopsis: f.synopsis_long,
      filmDurationMins: f.duration_mins,
      filmReviewStars: f.review_stars,
      filmReviewTxt: f.review_txt,
    },
    cinemaName: o.ticket.filmOfCinema.cinema.cinema_name,
    cinemaCity: o.ticket.filmOfCinema.cinema.city,
    seatRow: o.ticket.seat.row,
    seatColumn: o.ticket.seat.column,
    orderStatus: o.status,
    createdAt: o.createdAt,
  };
}

function buildUserFrequentData(
  userId: string,
  orders: FrequentOrderWithRelations[],
): UserOrderFrequentData {
  const user = orders[0].user;

  const orderDetails: OrderDetail[] = orders.map(buildOrderDetail);

  // Top films
  const filmCount = new Map<
    string,
    { filmName: string; filmGenres: string[] | null; count: number }
  >();
  for (const o of orders) {
    const filmName = o.ticket.filmOfCinema.film.film_name;
    const existing = filmCount.get(filmName);
    if (existing) {
      existing.count += 1;
    } else {
      filmCount.set(filmName, {
        filmName,
        filmGenres: parseStringArray(o.ticket.filmOfCinema.film.genres),
        count: 1,
      });
    }
  }
  const topFilms = [...filmCount.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((f) => ({
      filmName: f.filmName,
      filmGenres: f.filmGenres,
      orderCount: f.count,
    }));

  // Top cinemas
  const cinemaCount = new Map<
    string,
    { cinemaName: string; cinemaCity: string; count: number }
  >();
  for (const o of orders) {
    const cinemaName = o.ticket.filmOfCinema.cinema.cinema_name;
    const existing = cinemaCount.get(cinemaName);
    if (existing) {
      existing.count += 1;
    } else {
      cinemaCount.set(cinemaName, {
        cinemaName,
        cinemaCity: o.ticket.filmOfCinema.cinema.city,
        count: 1,
      });
    }
  }
  const topCinemas = [...cinemaCount.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((c) => ({
      cinemaName: c.cinemaName,
      cinemaCity: c.cinemaCity,
      orderCount: c.count,
    }));

  // Status breakdown
  const statusCount = new Map<string, number>();
  for (const o of orders) {
    statusCount.set(o.status, (statusCount.get(o.status) || 0) + 1);
  }
  const orderStatusBreakdown = [...statusCount.entries()].map(
    ([status, count]) => ({
      status,
      count,
    }),
  );

  const totalSpent = orders.reduce((sum, o) => sum + o.ticket.price, 0);
  const avgTicketPrice = totalSpent / orders.length;

  return {
    userId,
    userFullname: user.fullname,
    userEmail: user.email,
    totalOrders: orders.length,
    totalSpent,
    avgTicketPrice,
    topFilms,
    topCinemas,
    orderStatusBreakdown,
    firstOrder: orders[0].createdAt,
    lastOrder: orders[orders.length - 1].createdAt,
    orders: orderDetails,
  };
}

@Injectable()
export class TrackingFrequentDataService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Query frequent order data for all users.
   */
  async getFrequentData(): Promise<TrackingFrequentResult> {
    const orders = await this.prisma.order.findMany({
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    // Group orders by userId
    const userOrderMap = new Map<string, typeof orders>();
    for (const order of orders) {
      const existing = userOrderMap.get(order.userId) || [];
      existing.push(order);
      userOrderMap.set(order.userId, existing);
    }

    const userFrequentData = [...userOrderMap.entries()]
      .map(([userId, userOrders]) => buildUserFrequentData(userId, userOrders))
      .sort((a, b) => b.totalOrders - a.totalOrders);

    return {
      users: userFrequentData,
      totalCount: userFrequentData.length,
    };
  }
}
