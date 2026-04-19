-- Generated from prisma/schema/*.prisma
-- Target: PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VERSION_TYPE') THEN
    CREATE TYPE "VERSION_TYPE" AS ENUM ('STANDARD', 'DOLBY_CINEMA', 'IMAX');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ACCOUNT_STATUS') THEN
    CREATE TYPE "ACCOUNT_STATUS" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TICKET_STATUS') THEN
    CREATE TYPE "TICKET_STATUS" AS ENUM ('BOOKED', 'CANCELLED', 'AVAILABLE', 'USED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PAYMENT_STATUS') THEN
    CREATE TYPE "PAYMENT_STATUS" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SEAT_STATUS') THEN
    CREATE TYPE "SEAT_STATUS" AS ENUM ('AVAILABLE', 'BOOKED', 'OCCUPIED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "fullname" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "hashPassword" TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3) NOT NULL,
  "address" TEXT NOT NULL,
  "status" "ACCOUNT_STATUS" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS "Cinema" (
  "cinema_id" INTEGER PRIMARY KEY,
  "cinema_name" TEXT NOT NULL,
  "address" TEXT,
  "address2" TEXT,
  "city" TEXT NOT NULL,
  "country" TEXT,
  "postcode" TEXT NOT NULL,
  "phone" TEXT,
  "logo_url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "Film" (
  "film_id" INTEGER PRIMARY KEY,
  "film_name" TEXT NOT NULL,
  "other_title" JSONB,
  "release_dates" JSONB,
  "age_rating" JSONB,
  "trailers" JSONB,
  "synopsis_long" TEXT,
  "images" JSONB,
  "version_type" "VERSION_TYPE" NOT NULL,
  "duration_mins" INTEGER NOT NULL,
  "review_stars" DOUBLE PRECISION NOT NULL,
  "review_txt" TEXT,
  "distributor" TEXT,
  "genres" JSONB,
  "cast" JSONB,
  "directors" JSONB,
  "producers" JSONB,
  "writers" JSONB
);

CREATE TABLE IF NOT EXISTS "FilmOfCinema" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "filmId" INTEGER NOT NULL,
  "cinemaId" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "Seat" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "row" INTEGER NOT NULL,
  "column" INTEGER NOT NULL,
  "status" "SEAT_STATUS" NOT NULL DEFAULT 'AVAILABLE',
  "filmId" UUID NOT NULL,
  "cinemaId" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "Ticket" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" UUID NOT NULL,
  "filmOfCinemaId" UUID NOT NULL,
  "seatId" UUID NOT NULL,
  "status" "TICKET_STATUS" NOT NULL DEFAULT 'AVAILABLE'
);

CREATE TABLE IF NOT EXISTS "MomoPayment" (
  "requestId" TEXT PRIMARY KEY,
  "partnerCode" TEXT NOT NULL,
  "partnerName" TEXT,
  "storeId" TEXT,
  "amount" DECIMAL NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderInfo" TEXT NOT NULL,
  "autoCapture" BOOLEAN,
  "redirectUrl" TEXT NOT NULL,
  "ipnUrl" TEXT NOT NULL,
  "requestType" TEXT NOT NULL,
  "extraData" TEXT NOT NULL,
  "lang" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "paymentStatus" "PAYMENT_STATUS" NOT NULL DEFAULT 'PENDING',
  "ticketId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "hashRefreshToken" TEXT,
  "userIp" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "User"
  ADD CONSTRAINT "User_email_key" UNIQUE ("email");

ALTER TABLE "FilmOfCinema"
  ADD CONSTRAINT "FilmOfCinema_filmId_cinemaId_key" UNIQUE ("filmId", "cinemaId");

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_seatId_key" UNIQUE ("seatId");

ALTER TABLE "MomoPayment"
  ADD CONSTRAINT "MomoPayment_ticketId_key" UNIQUE ("ticketId");

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userIp_key" UNIQUE ("userIp");

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_userIp_key" UNIQUE ("userId", "userIp");

CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User" ("email");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX IF NOT EXISTS "Seat_filmId_cinemaId_idx" ON "Seat" ("filmId", "cinemaId");
CREATE INDEX IF NOT EXISTS "Ticket_userId_seatId_idx" ON "Ticket" ("userId", "seatId");

ALTER TABLE "FilmOfCinema"
  ADD CONSTRAINT "FilmOfCinema_filmId_fkey"
  FOREIGN KEY ("filmId") REFERENCES "Film"("film_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FilmOfCinema"
  ADD CONSTRAINT "FilmOfCinema_cinemaId_fkey"
  FOREIGN KEY ("cinemaId") REFERENCES "Cinema"("cinema_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Seat"
  ADD CONSTRAINT "Seat_filmId_fkey"
  FOREIGN KEY ("filmId") REFERENCES "FilmOfCinema"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Seat"
  ADD CONSTRAINT "Seat_cinemaId_fkey"
  FOREIGN KEY ("cinemaId") REFERENCES "Cinema"("cinema_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_filmOfCinemaId_fkey"
  FOREIGN KEY ("filmOfCinemaId") REFERENCES "FilmOfCinema"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_seatId_fkey"
  FOREIGN KEY ("seatId") REFERENCES "Seat"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MomoPayment"
  ADD CONSTRAINT "MomoPayment_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MomoPayment"
  ADD CONSTRAINT "MomoPayment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
