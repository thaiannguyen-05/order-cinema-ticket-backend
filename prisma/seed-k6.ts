/**
 * Seed K6 payment load-test data.
 *
 * Canonical terms (CONTEXT.md): User, Cinema, Room, Seat, Film,
 * FilmOfCinema, ShowTime, Ticket (AVAILABLE), Order (PENDING via k6).
 *
 * Rerunnable: upserts User/Cinema/Film by unique key, wipes only K6
 * ShowTimes/Seats/Tickets/Orders before recreating.
 *
 * Run: npx ts-node prisma/seed-k6.ts
 * Output: k6/seeds.json { email, password, price, ticketIds[] }
 */
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const K6_EMAIL = process.env.K6_EMAIL || 'k6@test.local';
const K6_PASSWORD = process.env.K6_PASSWORD || 'Test1234';
const K6_CINEMA_ID = 900001;
const K6_FILM_ID = 900001;
const K6_IMDB_ID = 900001;
const TICKET_PRICE = 100000;
const SEAT_COUNT = Number(process.env.K6_SEATS || 100);
const SHOWTIME_COUNT = Number(process.env.K6_SHOWTIMES || 5);
// default 100 x 5 = 500 tickets; e.g. K6_SEATS=200 K6_SHOWTIMES=10 => 2000

async function main() {
  const hashPassword = await hash(K6_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: K6_EMAIL.toLowerCase() },
    update: {
      hashPassword,
      status: 'ACTIVE',
      isActive: true,
      role: 'USER',
    },
    create: {
      fullname: 'K6 Load Test',
      email: K6_EMAIL.toLowerCase(),
      hashPassword,
      dateOfBirth: new Date('2000-01-01'),
      address: 'K6 Lab',
      status: 'ACTIVE',
      role: 'USER',
      isActive: true,
    },
  });

  // Wipe previous K6 orders first (FK Order.ticketId Restrict).
  await prisma.order.deleteMany({ where: { userId: user.id } });

  const cinema = await prisma.cinema.upsert({
    where: { cinema_id: K6_CINEMA_ID },
    update: { cinema_name: 'K6 Test Cinema' },
    create: {
      cinema_id: K6_CINEMA_ID,
      cinema_name: 'K6 Test Cinema',
      city: 'HCMC',
      country: 'VN',
    },
  });

  const film = await prisma.film.upsert({
    where: { film_id: K6_FILM_ID },
    update: { film_name: 'K6 Test Film' },
    create: {
      film_id: K6_FILM_ID,
      imdb_id: K6_IMDB_ID,
      film_name: 'K6 Test Film',
    },
  });

  let filmOfCinema = await prisma.filmOfCinema.findFirst({
    where: { cinemaId: cinema.id, filmId: film.id },
  });
  if (!filmOfCinema) {
    filmOfCinema = await prisma.filmOfCinema.create({
      data: { cinemaId: cinema.id, filmId: film.id },
    });
  }

  let room = await prisma.room.findFirst({
    where: { cinemaId: cinema.id },
  });
  if (!room) {
    room = await prisma.room.create({ data: { cinemaId: cinema.id } });
  }

  // Wipe old K6 showtimes (cascade deletes their tickets) + seats.
  await prisma.showTime.deleteMany({ where: { filmId: filmOfCinema.id } });
  await prisma.seat.deleteMany({ where: { roomId: room.id } });

  const seats = await prisma.seat.createManyAndReturn({
    data: Array.from({ length: SEAT_COUNT }, (_, i) => ({
      row: String.fromCharCode(65 + Math.floor(i / 10)), // A..J
      column: String((i % 10) + 1),
      seatType: 'NORMAL' as const,
      seatStatus: 'AVAILABLE' as const,
      roomId: room.id,
    })),
  });

  const now = Date.now();
  const showTimes = await prisma.showTime.createManyAndReturn({
    data: Array.from({ length: SHOWTIME_COUNT }, (_, d) => ({
      filmId: filmOfCinema.id,
      roomId: room.id,
      startAt: new Date(now + (d + 1) * 24 * 3600 * 1000),
      endAt: new Date(now + (d + 1) * 24 * 3600 * 1000 + 2 * 3600 * 1000),
      basedPrice: TICKET_PRICE,
    })),
  });

  // One Ticket per (seat x showtime) => SEAT_COUNT x SHOWTIME_COUNT tickets.
  const ticketRows: { price: number; showTimeId: string; seatId: string }[] =
    [];
  for (const st of showTimes) {
    for (const s of seats) {
      ticketRows.push({
        price: TICKET_PRICE,
        showTimeId: st.id,
        seatId: s.id,
      });
    }
  }
  // createMany in chunks to stay under param limits.
  const createdIds: string[] = [];
  for (let i = 0; i < ticketRows.length; i += 200) {
    const chunk = ticketRows.slice(i, i + 200);
    const created = await prisma.ticket.createManyAndReturn({
      data: chunk.map((t) => ({ ...t, ticketStatus: 'AVAILABLE' as const })),
      select: { id: true },
    });
    createdIds.push(...created.map((t) => t.id));
  }

  const out = {
    email: K6_EMAIL.toLowerCase(),
    password: K6_PASSWORD,
    price: TICKET_PRICE,
    ticketIds: createdIds,
    showTimeIds: showTimes.map((s) => s.id),
  };
  writeFileSync(
    join(__dirname, '..', 'k6', 'seeds.json'),
    JSON.stringify(out, null, 2),
  );

  console.log(
    `seed-k6 done: user=${out.email} tickets=${createdIds.length} showtimes=${showTimes.length} seats=${seats.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
