# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NestJS 11 backend for ordering cinema tickets. Uses TypeScript 5.7, Prisma 7 with PostgreSQL, RabbitMQ for async messaging, Redis for caching/distributed locks, and MoMo payment gateway integration. External SDKs: `@andev2005/momo-sdk` and `@andev2005/movie-glu-sdk` (for movie data).

## Essential Commands

### Development
```bash
pnpm run dev          # Start with hot reload
pnpm run build        # Compile to dist/
pnpm run prod         # Run production build
pnpm run generate     # Prisma generate + db push (sync schema)
pnpm run db:seed      # Seed database
```

### Infrastructure
```bash
docker compose up -d  # Start PostgreSQL, RabbitMQ, Redis
docker compose down   # Stop all services
```

### Testing
```bash
pnpm run test         # Run all unit tests (Jest, matches src/**/*.spec.ts)
pnpm run test:watch   # Watch mode
pnpm run test:cov     # With coverage
pnpm run test:e2e     # E2E tests (matches test/**/*.e2e-spec.ts)
```

### Code Quality
```bash
pnpm run lint         # ESLint check
pnpm run lint:fix     # ESLint auto-fix
pnpm run format       # Prettier format
```

## Architecture

### High-Level Structure
```
src/
├── main.ts                        # Entry point (bootstrap, microservices, Swagger)
├── app.module.ts                  # Root module (global providers, imports)
├── core/                          # Shared cross-cutting concerns
│   ├── decorator/                 # @Public, @Roles, @User, @Ip
│   ├── exception/                 # Global error filter (ErrorException)
│   ├── guard/                     # Auth, Roles, RateLimit guards
│   ├── intercepter/               # Response, Logging interceptors
│   ├── logger/                    # Winston logger
│   ├── middleware/                # Custom middleware
│   └── type/                      # TypeScript types
├── module/                        # Feature modules
│   ├── core-module/               # Auth, User
│   ├── theater-module/            # Film, Cinema, Seat, Ticket
│   └── payment/                   # MoMo payment
├── background/                    # Background workers & cron jobs
│   ├── email/                     # RabbitMQ email consumer
│   ├── redis/                     # Redis + Redlock services
│   ├── prisma/                    # Prisma database service
│   ├── sync-data-cron-job/        # Cron: sync movie data
│   └── outbox-cron-job/           # Cron: outbox pattern for email
└── test/                          # Unit tests (co-located spec files)
```

### Global Providers (app.module.ts)
- **Guards**: `AuthenticationGuard` (JWT auth), `ThrottlerBehindProxyGuard` (rate limiting 50 req/min), `RolesGuard` (RBAC)
- **Interceptors**: `ResponseInterceptor` (wraps responses), `LoggingInterceptor` (request logging)
- **Filter**: `ErrorException` (centralized error handling)
- **Pipe**: `ValidationPipe` (class-validator + class-transformer, global in main.ts)

### Authentication Flow
- JWT access tokens (Bearer) + HTTP-only cookies for refresh tokens and session IDs
- Routes decorated with `@Public()` skip auth guard
- Routes decorated with `@Roles()` enforce role-based access
- CSRF protection enabled in production (skipped in development)
- Uses argon2 for password hashing

### Database
- Prisma with split schema files in `prisma/schema/`
- Schema files: `schema.prisma` (generator/datasource), plus one per domain: `user.prisma`, `cinema.prisma`, `film.prisma`, `ticket.prisma`, `seat.prisma`, `payment.prisma`
- Database sync: `pnpm run generate` runs `prisma generate && prisma db push`
- Service: `src/background/prisma/` provides PrismaService via DI

### Microservices
- RabbitMQ queues: `GMAIL_SERVICE` (email sending), `SYNC_DATE_SERVICE` (data sync)
- Registered in `main.ts` via `app.connectMicroservice()`
- Email uses outbox pattern (`OutboxCronJobModule`) for reliable delivery

### API Endpoints
- Swagger docs at `/docs` (JSON at `/docs/json`, YAML at `/docs/yaml`)
- `/auth` - Register, login, logout, refresh, forgot/reset password, email verification
- `/film` - CRUD (admin write, public read)
- `/cinema` - Cinema management
- `/seat` - Seat management
- `/ticket` - Booking and retrieval
- `/user` - User management
- `/momo` - Payment creation, status check, IPN webhook
- Prometheus metrics endpoint (default `/metrics`)

### Key External Dependencies
- MoMo SDK: `@andev2005/momo-sdk` (payment gateway)
- Movie Data SDK: `@andev2005/movie-glu-sdk` (film/cinema data from external API)
- Both are custom SDKs under `@andev2005` namespace

### Environment
- Config files: `.env.development`, `.env.production` (or `.env.${NODE_ENV}`)
- Required env vars at bootstrap: `RABBITMQ_USER`, `RABBITMQ_PASS`, `RABBITMQ_PORT`, `REDIS_PORT`
- Bootstrap waits up to 120s for RabbitMQ and Redis before starting

## Conventions
- Use `@Public()` decorator on routes that don't require authentication
- Use `@Roles()` for role-restricted endpoints
- DTOs use `class-validator` decorators for validation
- All responses go through `ResponseInterceptor` (wraps in standard format)
- Errors handled by `ErrorException` filter
- Database operations through PrismaService (never raw queries)
- Async work (email, sync) goes through RabbitMQ queues, not direct calls
