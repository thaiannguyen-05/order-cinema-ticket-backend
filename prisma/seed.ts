import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ACCOUNT_STATUS,
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

const USER_COUNT = 1000;
const FILM_COUNT = 180;
const CINEMA_COUNT = 40;
const FILMS_PER_CINEMA = 24;
const TICKET_COUNT = 3000;

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

  return {
    film_id: filmId,
    film_name: `Film ${filmId}`,
    synopsis_long: `Synopsis for Film ${filmId}`,
    version_type: versionType,
    duration_mins: 85 + (index % 70),
    review_stars: 3.5 + (index % 16) * 0.1,
    review_txt: `Review text for Film ${filmId}`,
    distributor: `Distributor ${(index % 12) + 1}`,
    genres: ['Action', 'Drama', `Genre-${(index % 8) + 1}`],
    cast: [`Actor ${(index % 90) + 1}`, `Actor ${(index % 110) + 2}`],
    directors: [`Director ${(index % 25) + 1}`],
    producers: [`Producer ${(index % 40) + 1}`],
    writers: [`Writer ${(index % 45) + 1}`],
  };
}

function buildCinemaPayload(index: number) {
  const cinemaId = 1 + index;
  return {
    cinema_id: cinemaId,
    cinema_name: `Cinema ${cinemaId}`,
    address: `${100 + index} Main Street`,
    address2: `District ${(index % 12) + 1}`,
    city: 'Ho Chi Minh',
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
    ACCOUNT_STATUS.PENDING,
    ACCOUNT_STATUS.INACTIVE,
  ];
  const userNo = index + 1;

  return {
    fullname: `Seed User ${userNo}`,
    email: `seed.user.${String(userNo).padStart(4, '0')}@cinema.local`,
    isActive: index % 10 !== 0,
    hashPassword: 'seeded_hash_password',
    dateOfBirth: new Date(
      `19${80 + (index % 20)}-${String((index % 12) + 1).padStart(
        2,
        '0',
      )}-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    ),
    address: `${userNo} Seed Street, Ho Chi Minh`,
    status: statusOrder[index % statusOrder.length],
  };
}

async function main() {
  logInfo('SEED START');

  await runStep('cleanup old data', async () => {
    await prisma.momoPayment.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.session.deleteMany();
    await prisma.seat.deleteMany();
    await prisma.filmOfCinema.deleteMany();
    await prisma.user.deleteMany();
    await prisma.film.deleteMany();
    await prisma.cinema.deleteMany();
  });

  const cinemasData = Array.from({ length: CINEMA_COUNT }, (_, index) =>
    buildCinemaPayload(index),
  );
  const filmsData = Array.from({ length: FILM_COUNT }, (_, index) =>
    buildFilmPayload(index),
  );
  const usersData = Array.from({ length: USER_COUNT }, (_, index) =>
    buildUserPayload(index),
  );

  await runStep('create cinemas', async () =>
    prisma.cinema.createMany({
      data: cinemasData,
    }),
  );

  await runStep('create films', async () =>
    prisma.film.createMany({
      data: filmsData,
    }),
  );

  const filmOfCinemaData = await runStep('create filmOfCinema', async () => {
    const links: Array<{ filmId: number; cinemaId: number }> = [];

    for (let cinemaIndex = 0; cinemaIndex < CINEMA_COUNT; cinemaIndex += 1) {
      const cinemaId = cinemaIndex + 1;
      for (let offset = 0; offset < FILMS_PER_CINEMA; offset += 1) {
        links.push({
          filmId: 1000 + ((cinemaIndex * 7 + offset) % FILM_COUNT),
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

  const createdSeats = await runStep('create seats', async () => {
    const firstFilmPerCinema = new Map<number, string>();
    for (const item of filmOfCinemaData) {
      if (!firstFilmPerCinema.has(item.cinemaId)) {
        firstFilmPerCinema.set(item.cinemaId, item.id);
      }
    }

    const seatsData = cinemasData.map((cinema, index) => {
      const filmOfCinemaId = firstFilmPerCinema.get(cinema.cinema_id);
      if (!filmOfCinemaId) {
        throw new Error(
          `Missing FilmOfCinema relation for cinemaId=${cinema.cinema_id}`,
        );
      }

      return {
        row: (index % 8) + 1,
        column: (index % 12) + 1,
        status: index % 3 === 0 ? SEAT_STATUS.BOOKED : SEAT_STATUS.AVAILABLE,
        filmId: filmOfCinemaId,
        cinemaId: cinema.cinema_id,
      };
    });

    await prisma.seat.createMany({ data: seatsData });

    return prisma.seat.findMany({
      select: {
        id: true,
        filmId: true,
      },
      orderBy: {
        cinemaId: 'asc',
      },
    });
  });

  await runStep('create users', async () =>
    prisma.user.createMany({
      data: usersData,
    }),
  );

  const createdUsers = await runStep('fetch created users', async () =>
    prisma.user.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: USER_COUNT,
    }),
  );

  await runStep('create sessions', async () => {
    const sessionsData = createdUsers.map((user, index) => ({
      userId: user.id,
      userIp: `10.10.${Math.floor(index / 254)}.${(index % 254) + 1}`,
      hashRefreshToken: `seed_refresh_token_${index + 1}`,
    }));

    return prisma.session.createMany({ data: sessionsData });
  });

  const ticketSeedCount = Math.min(TICKET_COUNT, createdSeats.length);

  await runStep('create tickets', async () => {
    const ticketsData = Array.from({ length: ticketSeedCount }, (_, index) => {
      const seat = createdSeats[index];

      return {
        code: `SEED-TICKET-${String(index + 1).padStart(6, '0')}`,
        price: 65000 + (index % 8) * 5000,
        filmOfCinemaId: seat.filmId,
        seatId: seat.id,
        userId: createdUsers[index % createdUsers.length].id,
      };
    });

    return prisma.ticket.createMany({ data: ticketsData });
  });

  logInfo(
    `SEED SUMMARY cinemas=${CINEMA_COUNT} films=${FILM_COUNT} filmOfCinema=${filmOfCinemaData.length} seats=${createdSeats.length} users=${USER_COUNT} sessions=${USER_COUNT} tickets=${ticketSeedCount}`,
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
