import 'dotenv/config';
import crypto from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ACCOUNT_STATUS,
  EVENT_TYPE,
  OrderStatus,
  PrismaClient,
  SEAT_STATUS,
  VERSION_TYPE,
} from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run seed.');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({ adapter });
const seedStartTime = Date.now();

// Target counts
const USER_COUNT = 200;
const FILM_COUNT = 5000;
const CINEMA_COUNT = 50;
const FILM_OF_CINEMA_COUNT = 6000;
const TICKET_COUNT = 3000;
const ORDER_COUNT = 3000; // 1:1 with ticket
const EVENT_TRACKING_COUNT = 8000;
const SESSION_COUNT = 600; // ~3 sessions per user (multiple devices)
const SEATS_PER_FILM_OF_CINEMA = 48; // rows 1-6, cols 1-8

function logInfo(message: string) {
  console.log(`[seed][${new Date().toISOString()}] ${message}`);
}

async function runStep<T>(
  stepName: string,
  runner: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  logInfo(`START ${stepName}`);

  try {
    const result = await runner();
    logInfo(`DONE  ${stepName} (${Date.now() - startedAt}ms)`);
    return result;
  } catch (error) {
    logInfo(`FAIL  ${stepName} (${Date.now() - startedAt}ms)`);
    throw error;
  }
}

function buildFilmPayload(index: number) {
  const filmId = 1000 + index;
  const versionTypes = [
    VERSION_TYPE.STANDARD,
    VERSION_TYPE.DOLBY_CINEMA,
    VERSION_TYPE.IMAX,
  ];
  const versionType = versionTypes[index % versionTypes.length];
  const genres = [
    'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance',
    'Thriller', 'Animation', 'Documentary', 'Fantasy',
  ];

  return {
    film_id: filmId,
    film_name: `Film ${filmId}`,
    synopsis_long: `Synopsis for Film ${filmId}. A captivating story that explores themes of human nature and society.`,
    version_type: versionType,
    duration_mins: 75 + (index % 90),
    review_stars: 3.0 + (index % 21) * 0.1,
    review_txt: `Review text for Film ${filmId}`,
    distributor: `Distributor ${(index % 15) + 1}`,
    genres: [genres[index % genres.length], genres[(index + 3) % genres.length]],
    cast: [`Actor ${(index % 50) + 1}`, `Actor ${(index % 60) + 2}`, `Actor ${(index % 70) + 3}`],
    directors: [`Director ${(index % 20) + 1}`],
    producers: [`Producer ${(index % 30) + 1}`],
    writers: [`Writer ${(index % 25) + 1}`],
  };
}

function buildCinemaPayload(index: number) {
  const cinemaId = 1 + index;
  const cities = ['Ho Chi Minh', 'Ha Noi', 'Da Nang', 'Nha Trang', 'Hai Phong'];
  const districts = ['District 1', 'District 3', 'District 5', 'District 7', 'District 9', 'District 10', 'District 12'];

  return {
    cinema_id: cinemaId,
    cinema_name: `Cinema ${cinemaId} - ${cities[index % cities.length]}`,
    address: `${100 + index} ${['Main', 'Broadway', 'Park', 'Market', 'River'][index % 5]} Street`,
    address2: districts[index % districts.length],
    city: cities[index % cities.length],
    country: 'Vietnam',
    postcode: `${700000 + index}`,
    phone: `0281000${String(cinemaId).padStart(4, '0')}`,
    logo_url: `https://example.com/cinema/logo-${cinemaId}.png`,
  };
}

function buildUserPayload(index: number) {
  const statusOrder = [
    ACCOUNT_STATUS.ACTIVE,
    ACCOUNT_STATUS.ACTIVE,
    ACCOUNT_STATUS.ACTIVE,
    ACCOUNT_STATUS.PENDING,
    ACCOUNT_STATUS.INACTIVE,
  ];
  const userNo = index + 1;

  return {
    fullname: `Seed User ${userNo}`,
    email: `seed.user.${String(userNo).padStart(4, '0')}@cinema.local`,
    isActive: index % 10 !== 0,
    hashPassword: '$argon2id$v=19$m=65536,t=3,p=4$seed$placeholder',
    dateOfBirth: new Date(
      `19${80 + (index % 20)}-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    ),
    address: `${userNo} Seed Street, Ho Chi Minh`,
    status: statusOrder[index % statusOrder.length],
  };
}

const PAGES = [
  'home', 'film-list', 'film-detail', 'booking', 'payment',
  'my-tickets', 'profile', 'cinema-list', 'search',
];
const ELEMENT_TYPES = ['button', 'link', 'input', 'card', 'dropdown', null, null];
const ELEMENT_TEXTS = ['Book Now', 'Select Seat', 'Pay', 'Search', 'Login', 'View Details', 'Cancel', 'Confirm'];
const TARGET_IDS = ['film-1001', 'cinema-5', 'seat-A1', 'payment-form', 'booking-btn', null, null];

function buildEventTrackingPayload(index: number, userIds: string[]) {
  const eventTypeValues = [
    EVENT_TYPE.CLICK,
    EVENT_TYPE.VIEW,
    EVENT_TYPE.SCROLL,
    EVENT_TYPE.SUBMIT,
  ];
  // 80% have userId, 20% anonymous
  const hasUser = index % 5 !== 0;
  const userId = hasUser ? userIds[index % userIds.length] : null;

  return {
    userId,
    eventType: eventTypeValues[index % eventTypeValues.length],
    page: PAGES[index % PAGES.length],
    elementType: ELEMENT_TYPES[index % ELEMENT_TYPES.length],
    elementId: index % 3 === 0 ? `element-${index}` : undefined,
    elementText: index % 4 === 0 ? ELEMENT_TEXTS[index % ELEMENT_TEXTS.length] : undefined,
    targetId: index % 5 === 0 ? TARGET_IDS[index % TARGET_IDS.length] : undefined,
    metadata: index % 6 === 0 ? { duration: 100 + index % 500, section: `section-${index % 10}` } : undefined,
  };
}

async function main() {
  logInfo('SEED START');

  // ── Step 0: Cleanup (respect FK: Order → Ticket Restrict, Order → Payment) ──
  await runStep('cleanup old data', async () => {
    await prisma.order.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.eventTracking.deleteMany();
    await prisma.session.deleteMany();
    await prisma.seat.deleteMany();
    await prisma.filmOfCinema.deleteMany();
    await prisma.user.deleteMany();
    await prisma.film.deleteMany();
    await prisma.cinema.deleteMany();
    await prisma.payment.deleteMany();
  });

  // ── Step 1: Cinemas (50) ──
  const cinemasData = Array.from({ length: CINEMA_COUNT }, (_, i) =>
    buildCinemaPayload(i),
  );
  await runStep('create cinemas', async () =>
    prisma.cinema.createMany({ data: cinemasData }),
  );

  // ── Step 2: Films (5000) ──
  const filmsData = Array.from({ length: FILM_COUNT }, (_, i) =>
    buildFilmPayload(i),
  );
  // Prisma createMany has a limit; batch in chunks of 1000
  const FILM_BATCH = 1000;
  await runStep('create films', async () => {
    for (let i = 0; i < filmsData.length; i += FILM_BATCH) {
      await prisma.film.createMany({
        data: filmsData.slice(i, i + FILM_BATCH),
      });
    }
  });

  // ── Step 3: FilmOfCinema (6000) ──
  const filmOfCinemaData = await runStep('create filmOfCinema', async () => {
    const links: Array<{ filmId: number; cinemaId: number }> = [];

    // Distribute 6000 across 50 cinemas = 120 each
    // Ensure we don't exceed 5000 unique films
    for (let cinemaIndex = 0; cinemaIndex < CINEMA_COUNT; cinemaIndex += 1) {
      const cinemaId = cinemaIndex + 1;
      for (let offset = 0; offset < FILM_OF_CINEMA_COUNT / CINEMA_COUNT; offset += 1) {
        // Spread across films, avoiding duplicate (filmId, cinemaId) pairs
        const filmIdx = (cinemaIndex * 120 + offset) % FILM_COUNT;
        links.push({
          filmId: 1000 + filmIdx,
          cinemaId,
        });
      }
    }

    await prisma.filmOfCinema.createMany({
      data: links,
      skipDuplicates: true,
    });

    return prisma.filmOfCinema.findMany({
      select: { id: true, cinemaId: true, filmId: true },
    });
  });

  // ── Step 4: Seats (FilmOfCinema × 48) ──
  // Create seats for a larger pool of FilmOfCinema entries for rich data
  const SEAT_BATCH = 2000;
  const FILM_OF_CINEMA_FOR_SEATS = 200; // seats for 200 showings = 9600 seats
  const filmOfCinemaForSeats = filmOfCinemaData.slice(0, FILM_OF_CINEMA_FOR_SEATS);

  await runStep('create seats', async () => {
    const seatsData: Array<{
      row: number;
      column: number;
      status: SEAT_STATUS;
      filmId: string;
      cinemaId: number;
    }> = [];

    for (const foc of filmOfCinemaForSeats) {
      for (let seatIndex = 0; seatIndex < SEATS_PER_FILM_OF_CINEMA; seatIndex += 1) {
        const row = Math.floor(seatIndex / 8) + 1;
        const col = (seatIndex % 8) + 1;
        seatsData.push({
          row,
          column: col,
          status: seatIndex % 10 === 0 ? SEAT_STATUS.BOOKED : SEAT_STATUS.AVAILABLE,
          filmId: foc.id,
          cinemaId: foc.cinemaId,
        });
      }
    }

    // Batch create
    for (let i = 0; i < seatsData.length; i += SEAT_BATCH) {
      await prisma.seat.createMany({
        data: seatsData.slice(i, i + SEAT_BATCH),
      });
    }

    return prisma.seat.findMany({
      select: { id: true, filmId: true, cinemaId: true, status: true },
      orderBy: { id: 'asc' },
    });
  });

  // ── Step 5: Users (200) ──
  const usersData = Array.from({ length: USER_COUNT }, (_, i) =>
    buildUserPayload(i),
  );
  await runStep('create users', async () =>
    prisma.user.createMany({ data: usersData }),
  );

  const createdUsers = await runStep('fetch created users', async () =>
    prisma.user.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: USER_COUNT,
    }),
  );
  const userIds = createdUsers.map((u) => u.id);

  // ── Step 6: Sessions (~3 per user, different IPs/devices) ──
  await runStep('create sessions', async () => {
    const sessionsData: Array<{
      userId: string;
      userIp: string;
      hashRefreshToken: string;
    }> = [];

    for (const user of createdUsers) {
      for (let s = 0; s < 3; s += 1) {
        sessionsData.push({
          userId: user.id,
          userIp: `192.168.${s}.${Math.floor(Math.random() * 254) + 1}`,
          hashRefreshToken: `seed_refresh_${user.id.slice(0, 8)}_dev${s}`,
        });
      }
    }

    return prisma.session.createMany({ data: sessionsData });
  });

  // ── Step 7: EventTracking (2000) ──
  await runStep('create event tracking', async () => {
    const EVENT_BATCH = 500;
    const eventsData = Array.from({ length: EVENT_TRACKING_COUNT }, (_, i) =>
      buildEventTrackingPayload(i, userIds),
    );

    for (let i = 0; i < eventsData.length; i += EVENT_BATCH) {
      await prisma.eventTracking.createMany({
        data: eventsData.slice(i, i + EVENT_BATCH),
      });
    }

    return { count: EVENT_TRACKING_COUNT };
  });

  // ── Step 8: Tickets (500) ──
  const createdSeats = await runStep('fetch available seats', async () =>
    prisma.seat.findMany({
      where: { status: SEAT_STATUS.AVAILABLE },
      select: { id: true, filmId: true },
      orderBy: { id: 'asc' },
      take: TICKET_COUNT,
    }),
  );

  const ticketsData = Array.from({ length: TICKET_COUNT }, (_, index) => ({
    code: `SEED-TICKET-${String(index + 1).padStart(6, '0')}`,
    price: 65000 + (index % 8) * 5000,
    filmOfCinemaId: createdSeats[index % createdSeats.length].filmId,
    seatId: createdSeats[index % createdSeats.length].id,
  }));

  const createdTickets = await runStep('create tickets', async () => {
    await prisma.ticket.createMany({ data: ticketsData });

    return prisma.ticket.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: TICKET_COUNT,
    });
  });

  // ── Step 9: Payments + Orders (grouped into ~50 orders/payment) ──
  await runStep('create payments and orders', async () => {
    const ORDER_PER_PAYMENT = 50;
    const paymentCount = Math.ceil(ORDER_COUNT / ORDER_PER_PAYMENT);

    const paymentStatuses = [
      OrderStatus.CAPTURED,
      OrderStatus.CAPTURED,
      OrderStatus.CAPTURED,
      OrderStatus.CANCELLED,
      OrderStatus.AUTHENTICATION_NOT_NEEDED,
    ];

    for (let p = 0; p < paymentCount; p += 1) {
      const batchSize = Math.min(ORDER_PER_PAYMENT, ORDER_COUNT - p * ORDER_PER_PAYMENT);
      const priceOptions = [65000, 75000, 85000, 95000, 110000, 120000];
      const avgPrice = priceOptions[p % priceOptions.length];
      const paymentAmount = batchSize * avgPrice;

      const payment = await prisma.payment.create({
        data: {
          orderId: crypto.randomUUID(),
          amount: paymentAmount,
          orderStatus: paymentStatuses[p % paymentStatuses.length],
          currency: 'VND',
        },
      });

      const ordersForThisPayment = createdTickets
        .slice(p * ORDER_PER_PAYMENT, (p + 1) * ORDER_PER_PAYMENT)
        .map((ticket, idx) => ({
          userId: userIds[(p * ORDER_PER_PAYMENT + idx) % userIds.length],
          ticketId: ticket.id,
          paymentId: payment.id,
          status: OrderStatus.AUTHENTICATION_NOT_NEEDED,
        }));

      if (ordersForThisPayment.length > 0) {
        await prisma.order.createMany({ data: ordersForThisPayment });
      }
    }

    return { payments: paymentCount, orders: ORDER_COUNT };
  });

  // ── Summary ──
  const ticketFinal = await prisma.ticket.count();
  const orderFinal = await prisma.order.count();
  const eventFinal = await prisma.eventTracking.count();
  const filmFinal = await prisma.film.count();
  const cinemaFinal = await prisma.cinema.count();
  const filmOfCinemaFinal = await prisma.filmOfCinema.count();
  const seatFinal = await prisma.seat.count();
  const userFinal = await prisma.user.count();
  const sessionFinal = await prisma.session.count();
  const paymentFinal = await prisma.payment.count();

  logInfo(
    `SEED SUMMARY users=${userFinal} sessions=${sessionFinal} films=${filmFinal} cinemas=${cinemaFinal} filmOfCinema=${filmOfCinemaFinal} seats=${seatFinal} tickets=${ticketFinal} orders=${orderFinal} payments=${paymentFinal} eventTracking=${eventFinal}`,
  );
  logInfo(`SEED DONE (${Date.now() - seedStartTime}ms)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
