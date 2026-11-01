/**
 * Full system seed (fake data).
 *
 * Canonical terms (CONTEXT.md): User, Cinema, Room, Seat, Film,
 * FilmOfCinema, ShowTime, Ticket, Order, Session, SupportConversation,
 * SupportMessage, SupportDocument, Outbox.
 *
 * Assumes empty DB (run via `pnpm db:setup` = db push --force-reset + seed).
 * Rerun without reset will hit unique keys (cinema_id / film_id / email).
 *
 * Covers every relation + every status enum:
 * - Seat: AVAILABLE (95%) + NOT_AVAILABLE (5%, maintenance). Never BOOKED
 *   (BOOKED lives on Ticket — see sepay.service.ts + CONTEXT.md).
 * - Ticket: AVAILABLE / PROCESSING (Order PENDING) / BOOKED (Order PAID).
 *   FAILED/EXPIRED/CANCELLED Orders release back to AVAILABLE (CONTEXT.md).
 *   NOTE: cinema.prisma TicketStatus also has CANCELLED, but CONTEXT.md says
 *   FAILED/CANCELLED/EXPIRED -> AVAILABLE, so seed follows CONTEXT.md.
 * - Order: PENDING / PAID / FAILED / EXPIRED / CANCELLED.
 * - User: ACTIVE / INACTIVE / SUSPENDED / PENDING x USER / ADMIN.
 *
 * SupportDocument: seeds content+metadata only, embedding left NULL
 * (vector(1024) managed by prisma/vector-ext.sql, built by `pnpm ai:ingest`
 * at test time with real data — per owner request, no fake vectors).
 *
 * Run: pnpm run prisma:seed  (ts-node prisma/seed.ts)
 */

import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const PASSWORD = 'Test1234';

// Deterministic PRNG (mulberry32) so seed is stable across runs.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

/* ---------------------------------- data --------------------------------- */

const USERS = [
  {
    fullname: 'Seed Admin',
    email: 'admin@test.local',
    role: 'ADMIN' as const,
    status: 'ACTIVE' as const,
    isActive: true,
    dateOfBirth: new Date('1990-01-01'),
    address: '1 Fake Admin St, HCMC',
  },
  {
    fullname: 'Seed User 01',
    email: 'user01@test.local',
    role: 'USER' as const,
    status: 'ACTIVE' as const,
    isActive: true,
    dateOfBirth: new Date('1995-03-10'),
    address: '10 Fake St, HCMC',
  },
  {
    fullname: 'Seed User 02',
    email: 'user02@test.local',
    role: 'USER' as const,
    status: 'ACTIVE' as const,
    isActive: true,
    dateOfBirth: new Date('1998-07-22'),
    address: '20 Fake St, Hanoi',
  },
  {
    fullname: 'Seed User 03',
    email: 'user03@test.local',
    role: 'USER' as const,
    status: 'INACTIVE' as const,
    isActive: false,
    dateOfBirth: new Date('2000-11-05'),
    address: '30 Fake St, Da Nang',
  },
  {
    fullname: 'Seed User 04',
    email: 'user04@test.local',
    role: 'USER' as const,
    status: 'SUSPENDED' as const,
    isActive: false,
    dateOfBirth: new Date('1992-05-17'),
    address: '40 Fake St, HCMC',
  },
  {
    fullname: 'Seed User 05',
    email: 'user05@test.local',
    role: 'USER' as const,
    status: 'PENDING' as const,
    isActive: true,
    dateOfBirth: new Date('2002-09-09'),
    address: '50 Fake St, Hanoi',
  },
];

const CINEMAS = [
  {
    cinema_id: 100001,
    cinema_name: 'Fake Star Cinema HCMC',
    address: '100 Fake Le Loi',
    address2: 'Floor 5',
    city: 'HCMC',
    state: 'SG',
    country: 'VN',
    county: 'District 1',
    postcode: '700000',
    phone: '0280001001',
    lat: '10.7769',
    lng: '106.7009',
    distance: '1.2km',
    directions: 'Fake directions: near lake, gate A.',
    logo_url: 'https://example.com/logo-hcmc.png',
    show_dates: { dates: ['2026-11-02', '2026-11-03'] },
  },
  {
    cinema_id: 100002,
    cinema_name: 'Fake Star Cinema Hanoi',
    address: '200 Fake Hoan Kiem',
    address2: 'Floor 3',
    city: 'Hanoi',
    state: 'HN',
    country: 'VN',
    county: 'Hoan Kiem',
    postcode: '100000',
    phone: '0240001002',
    lat: '21.0285',
    lng: '105.8542',
    distance: '0.8km',
    directions: 'Fake directions: old quarter, gate B.',
    logo_url: 'https://example.com/logo-hanoi.png',
    show_dates: { dates: ['2026-11-02', '2026-11-03'] },
  },
  {
    cinema_id: 100003,
    cinema_name: 'Fake Star Cinema Da Nang',
    address: '300 Fake Bach Dang',
    address2: 'Floor 2',
    city: 'Da Nang',
    state: 'DN',
    country: 'VN',
    county: 'Hai Chau',
    postcode: '550000',
    phone: '02360001003',
    lat: '16.0544',
    lng: '108.2022',
    distance: '2.1km',
    directions: 'Fake directions: riverside, gate C.',
    logo_url: 'https://example.com/logo-danang.png',
    show_dates: { dates: ['2026-11-02', '2026-11-03'] },
  },
];

const FILMS = [
  {
    film_id: 200001,
    imdb_id: 300001,
    film_name: 'Fake Film: Paper Moon',
    other_titles: 'Paper Moon (fake)',
    release_dates: { cinema_release_date: '2026-10-01' },
    age_rating: { rating: 'T13', reason: 'fake rating' },
    film_trailer: 'https://example.com/trailer/paper-moon.mp4',
    synopsis_long: 'Fake synopsis: a paper moon rises over a fake city.',
    images: { poster: 'https://example.com/poster/paper-moon.jpg' },
  },
  {
    film_id: 200002,
    imdb_id: 300002,
    film_name: 'Fake Film: Noodle Heist',
    other_titles: null,
    release_dates: { cinema_release_date: '2026-10-05' },
    age_rating: { rating: 'T16', reason: 'fake rating' },
    film_trailer: 'https://example.com/trailer/noodle-heist.mp4',
    synopsis_long: 'Fake synopsis: a gang steals the last noodle bowl.',
    images: { poster: 'https://example.com/poster/noodle-heist.jpg' },
  },
  {
    film_id: 200003,
    imdb_id: 300003,
    film_name: 'Fake Film: River of Static',
    other_titles: null,
    release_dates: { cinema_release_date: '2026-10-10' },
    age_rating: { rating: 'T18', reason: 'fake rating' },
    film_trailer: 'https://example.com/trailer/river-static.mp4',
    synopsis_long: 'Fake synopsis: a radio host hears a river in static.',
    images: { poster: 'https://example.com/poster/river-static.jpg' },
  },
  {
    film_id: 200004,
    imdb_id: 300004,
    film_name: 'Fake Film: Mango Summer',
    other_titles: null,
    release_dates: { cinema_release_date: '2026-10-12' },
    age_rating: { rating: 'P', reason: 'fake rating' },
    film_trailer: 'https://example.com/trailer/mango-summer.mp4',
    synopsis_long: 'Fake synopsis: two kids chase mango season.',
    images: { poster: 'https://example.com/poster/mango-summer.jpg' },
  },
  {
    film_id: 200005,
    imdb_id: 300005,
    film_name: 'Fake Film: Clockwork Kite',
    other_titles: null,
    release_dates: { cinema_release_date: '2026-10-15' },
    age_rating: { rating: 'T13', reason: 'fake rating' },
    film_trailer: 'https://example.com/trailer/clockwork-kite.mp4',
    synopsis_long: 'Fake synopsis: a kite that only flies on time.',
    images: { poster: 'https://example.com/poster/clockwork-kite.jpg' },
  },
  {
    film_id: 200006,
    imdb_id: 300006,
    film_name: 'Fake Film: Silent Lantern',
    other_titles: null,
    release_dates: { cinema_release_date: '2026-10-20' },
    age_rating: { rating: 'T16', reason: 'fake rating' },
    film_trailer: 'https://example.com/trailer/silent-lantern.mp4',
    synopsis_long: 'Fake synopsis: a lantern that never goes out.',
    images: { poster: 'https://example.com/poster/silent-lantern.jpg' },
  },
];

// Order plan: covers every OrderStatus. Ticket follows CONTEXT.md mapping.
const ORDER_PLAN: Array<{
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  count: number;
}> = [
  { status: 'PAID', count: 10 },
  { status: 'PENDING', count: 6 },
  { status: 'FAILED', count: 3 },
  { status: 'EXPIRED', count: 3 },
  { status: 'CANCELLED', count: 2 },
];
const TICKET_FOR_ORDER = {
  PAID: 'BOOKED',
  PENDING: 'PROCESSING',
  FAILED: 'AVAILABLE',
  EXPIRED: 'AVAILABLE',
  CANCELLED: 'AVAILABLE',
} as const;

/* ---------------------------------- main --------------------------------- */

async function main() {
  const hashPassword = await hash(PASSWORD);

  // 1. Users (full role/status coverage, fake data)
  const users: Array<{ id: string; email: string }> = [];
  for (const u of USERS) {
    users.push(
      await prisma.user.create({
        data: { ...u, email: u.email.toLowerCase(), hashPassword },
      }),
    );
  }

  // 2. Cinemas
  const cinemas: Array<{ id: string }> = [];
  for (const c of CINEMAS) {
    cinemas.push(await prisma.cinema.create({ data: c }));
  }

  // 3. Films
  const films: Array<{ id: string }> = [];
  for (const f of FILMS) {
    films.push(await prisma.film.create({ data: f }));
  }

  // 4. Rooms: 2 per cinema = 6
  const rooms: Array<{ id: string; cinemaId: string }> = [];
  for (const cinema of cinemas) {
    for (let i = 0; i < 2; i++) {
      rooms.push(await prisma.room.create({ data: { cinemaId: cinema.id } }));
    }
  }
  const roomsByCinema = new Map<string, typeof rooms>();
  for (const r of rooms) {
    const list = roomsByCinema.get(r.cinemaId) ?? [];
    list.push(r);
    roomsByCinema.set(r.cinemaId, list);
  }

  // 5. Seats: 60/room (rows A-F x cols 1-10).
  // A-D NORMAL, E HEAVEN, F COUPLE; every 20th seat NOT_AVAILABLE.
  type SeatRow = { id: string; roomId: string; seatType: string };
  const seatsByRoom = new Map<string, SeatRow[]>();
  {
    const seatData: Array<{
      row: string;
      column: string;
      seatType: 'NORMAL' | 'HEAVEN' | 'COUPLE';
      seatStatus: 'AVAILABLE' | 'NOT_AVAILABLE';
      roomId: string;
    }> = [];
    for (const room of rooms) {
      for (let r = 0; r < 6; r++) {
        const rowLetter = String.fromCharCode(65 + r);
        const seatType =
          r <= 3
            ? ('NORMAL' as const)
            : r === 4
              ? ('HEAVEN' as const)
              : ('COUPLE' as const);
        for (let c = 1; c <= 10; c++) {
          const idx = r * 10 + c;
          seatData.push({
            row: rowLetter,
            column: String(c),
            seatType,
            seatStatus: idx % 20 === 0 ? 'NOT_AVAILABLE' : 'AVAILABLE',
            roomId: room.id,
          });
        }
      }
    }
    const created = await prisma.seat.createManyAndReturn({
      data: seatData,
      select: { id: true, roomId: true, seatType: true, seatStatus: true },
    });
    for (const s of created) {
      if (s.seatStatus !== 'AVAILABLE') continue; // no tickets for maintenance seats
      const list = seatsByRoom.get(s.roomId!) ?? [];
      list.push({ id: s.id, roomId: s.roomId!, seatType: s.seatType });
      seatsByRoom.set(s.roomId!, list);
    }
  }

  // 6. FilmOfCinema: full pairing 3 cinemas x 6 films = 18
  const pairs: Array<{ id: string; cinemaId: string }> = [];
  for (const cinema of cinemas) {
    for (const film of films) {
      pairs.push(
        await prisma.filmOfCinema.create({
          data: { cinemaId: cinema.id, filmId: film.id },
        }),
      );
    }
  }

  // 7. ShowTimes: ~45 total. First 9 pairs x3, rest x2.
  // Slots 10:00 (70k) / 15:00 (100k) / 20:00 (150k), duration 2h, next 7 days.
  const showTimes: Array<{
    id: string;
    filmId: string;
    roomId: string;
    basedPrice: number;
  }> = [];
  {
    const base = new Date();
    base.setDate(base.getDate() + 1);
    const slots = [
      { h: 10, price: 70000 },
      { h: 15, price: 100000 },
      { h: 20, price: 150000 },
    ];
    let day = 0;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const cinemaRooms = roomsByCinema.get(pair.cinemaId)!;
      const n = i < 9 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const slot = slots[(i + k) % slots.length];
        const startAt = new Date(base);
        startAt.setDate(base.getDate() + (day % 7));
        startAt.setHours(slot.h, 0, 0, 0);
        const endAt = new Date(startAt.getTime() + 2 * 3600 * 1000);
        const room = cinemaRooms[(i + k) % cinemaRooms.length];
        // small cinema variance +/-10k, rounded to 1k
        const jitter = Math.round(((rand() - 0.5) * 20000) / 1000) * 1000;
        const basedPrice = slot.price + jitter;
        const st = await prisma.showTime.create({
          data: {
            filmId: pair.id,
            roomId: room.id,
            startAt,
            endAt,
            basedPrice,
          },
          select: { id: true, filmId: true, roomId: true, basedPrice: true },
        });
        showTimes.push(st);
        day++;
      }
    }
  }

  // 8. Tickets: one per (showtime x available seat in same room).
  // price = basedPrice + 20k for COUPLE/HEAVEN.
  type TicketRow = { price: number; showTimeId: string; seatId: string };
  const ticketRows: TicketRow[] = [];
  const ticketPriceById = new Map<string, number>();
  for (const st of showTimes) {
    const roomSeats = seatsByRoom.get(st.roomId)!;
    for (const s of roomSeats) {
      const price =
        s.seatType === 'NORMAL' ? st.basedPrice : st.basedPrice + 20000;
      ticketRows.push({ price, showTimeId: st.id, seatId: s.id });
    }
  }
  const ticketIds: string[] = [];
  for (let i = 0; i < ticketRows.length; i += 200) {
    const chunk = ticketRows.slice(i, i + 200);
    const created = await prisma.ticket.createManyAndReturn({
      data: chunk.map((t) => ({ ...t, ticketStatus: 'AVAILABLE' as const })),
      select: { id: true, price: true },
    });
    for (let j = 0; j < created.length; j++) {
      ticketIds.push(created[j].id);
      ticketPriceById.set(created[j].id, chunk[j].price);
    }
  }

  // 9. Orders: deterministic shuffle, take 24 tickets.
  const totalOrders = ORDER_PLAN.reduce((a, p) => a + p.count, 0);
  const shuffled = [...ticketIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const orderTicketIds = shuffled.slice(0, totalOrders);
  const activeUsers = users.filter((u) => u.email !== 'user05@test.local');
  let cursor = 0;
  let orderSeq = 1;
  const now = Date.now();
  for (const plan of ORDER_PLAN) {
    for (let k = 0; k < plan.count; k++) {
      const ticketId = orderTicketIds[cursor++];
      const user = pick(activeUsers);
      const price = ticketPriceById.get(ticketId)!;
      const isPaid = plan.status === 'PAID';
      const isPending = plan.status === 'PENDING';
      await prisma.order.create({
        data: {
          finalPrice: price,
          currency: 'VND',
          status: plan.status,
          ticketId,
          userId: user.id,
          sepayOrderId: isPaid ? `SEED-ORDER-${orderSeq}` : null,
          sepayTransactionId: isPaid ? `SEED-TXN-${orderSeq}` : null,
          paymentMethod: isPaid ? pick(['SEPAY_BANK', 'SEPAY_QR']) : null,
          paidAmount: isPaid ? price : null,
          callbackPayload: isPaid
            ? { fake: true, seq: orderSeq, amount: price }
            : undefined,
          expiresAt:
            isPending || plan.status === 'CANCELLED'
              ? new Date(now + 15 * 60 * 1000)
              : new Date(now - 24 * 3600 * 1000),
        },
      });
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { ticketStatus: TICKET_FOR_ORDER[plan.status] },
      });
      orderSeq++;
    }
  }

  // 10. Sessions: 1 per user (unique userId+userIp).
  for (let i = 0; i < users.length; i++) {
    await prisma.session.create({
      data: {
        userId: users[i].id,
        userIp: `192.168.1.${11 + i}`,
        hashRefreshToken: `seeded-refresh-hash-${i + 1}`,
      },
    });
  }

  // 11. Outbox: respects @@unique([email, eventType]).
  await prisma.outbox.createMany({
    data: [
      {
        eventType: 'send_verify_code',
        email: 'user01@test.local',
        code: '111111',
        status: 'PENDING',
      },
      {
        eventType: 'send_forgot_password_email',
        email: 'user02@test.local',
        code: '222222',
        status: 'PENDING',
      },
      {
        eventType: 'send_verify_code',
        email: 'user03@test.local',
        code: '333333',
        status: 'PROCESSED',
      },
    ],
  });

  // 12. Support: 2 conversations (1 user + 1 anonymous) + 6 messages.
  const conv1 = await prisma.supportConversation.create({
    data: { userId: users[1].id },
  });
  const conv2 = await prisma.supportConversation.create({ data: {} });
  await prisma.supportMessage.createMany({
    data: [
      {
        conversationId: conv1.id,
        role: 'user',
        content: 'Fake: suất chiếu tối nay còn ghế không?',
      },
      {
        conversationId: conv1.id,
        role: 'assistant',
        content: 'Fake: còn trống hàng C-E suất 20:00, giá 150k.',
        sources: { fake: true, showTime: '20:00' },
        toolCalls: { fake: true, tool: 'film_showtime' },
        injectionVerdict: { fake: true, verdict: 'clean' },
      },
      {
        conversationId: conv1.id,
        role: 'user',
        content: 'Fake: đặt giúp tôi 2 vé hàng C.',
      },
      {
        conversationId: conv1.id,
        role: 'assistant',
        content: 'Fake: đã giữ 2 vé, vui lòng thanh toán trong 15 phút.',
      },
      {
        conversationId: conv2.id,
        role: 'user',
        content: 'Fake: rạp nào gần nhất?',
      },
      {
        conversationId: conv2.id,
        role: 'assistant',
        content: 'Fake: Fake Star Cinema HCMC cách bạn 1.2km.',
        sources: { fake: true },
      },
    ],
  });

  // 13. SupportDocuments: content+metadata only, embedding NULL
  // (built later by `pnpm ai:vector:ensure && pnpm ai:ingest` with real data).
  await prisma.supportDocument.createMany({
    data: [
      {
        content:
          'Fake film doc: Paper Moon — a paper moon rises over a fake city.',
        metadata: { source: 'Film', film_id: 200001 },
      },
      {
        content:
          'Fake film doc: Noodle Heist — a gang steals the last noodle bowl.',
        metadata: { source: 'Film', film_id: 200002 },
      },
      {
        content: 'Fake cinema doc: Fake Star Cinema HCMC, 100 Fake Le Loi.',
        metadata: { source: 'Cinema', cinema_id: 100001 },
      },
      {
        content: 'Fake cinema doc: Fake Star Cinema Hanoi, 200 Fake Hoan Kiem.',
        metadata: { source: 'Cinema', cinema_id: 100002 },
      },
      {
        content:
          'Fake policy: tickets can be cancelled within 15 minutes (PENDING only).',
        metadata: { source: 'docs/support/policy.md' },
      },
      {
        content:
          'Fake FAQ: SePay IPN is the only path that moves Order to PAID/FAILED.',
        metadata: { source: 'docs/support/faq.md' },
      },
    ],
  });

  console.log(
    `seed done: users=${users.length} cinemas=${cinemas.length} films=${films.length} ` +
      `rooms=${rooms.length} pairs=${pairs.length} showtimes=${showTimes.length} ` +
      `tickets=${ticketIds.length} orders=${totalOrders}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
