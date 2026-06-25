export const meta = {
  name: 'full-repo-review',
  description: 'Comprehensive review of all 155 TS files for standards compliance, bugs, and code quality',
  phases: [
    { title: 'Review', detail: '5 parallel agents review different code areas against CLAUDE.md standards' },
    { title: 'Synthesize', detail: 'Aggregate, deduplicate, rank findings, produce final report' },
  ],
};

const STANDARDS = [
  '## CLAUDE.md Standards',
  '',
  '### Architecture',
  '- src/module/ — Feature modules (core-module: auth/user, theater-module: film/cinema/seat/ticket)',
  '- src/background/ — Background workers & cron jobs (email, redis, prisma, sync-data, outbox, tracking-frequent)',
  '- src/core/ — Shared cross-cutting concerns (decorator, exception, guard, intercepter, logger, middleware, type)',
  '',
  '### Conventions',
  '1. Use @Public() decorator on routes that do not require authentication',
  '2. Use @Roles() for role-restricted endpoints',
  '3. DTOs use class-validator decorators for validation',
  '4. All responses go through ResponseInterceptor (wraps in standard format)',
  '5. Errors handled by ErrorException filter',
  '6. Database operations through PrismaService (NEVER raw queries)',
  '7. Async work (email, sync) goes through RabbitMQ queues, not direct calls',
  '8. JWT access tokens (Bearer) + HTTP-only cookies for refresh tokens and session IDs',
  '9. Uses argon2 for password hashing',
  '10. CSRF protection enabled in production',
  '',
  '### Global Providers (app.module.ts)',
  '- Guards: AuthenticationGuard (JWT auth), ThrottlerBehindProxyGuard (rate limiting 50 req/min), RolesGuard (RBAC)',
  '- Interceptors: ResponseInterceptor, LoggingInterceptor',
  '- Filter: ErrorException',
  '- Pipe: ValidationPipe (class-validator + class-transformer, global)',
  '',
  '### Tooling (skip issues already enforced by these)',
  '- ESLint: typescript-eslint recommendedTypeChecked, prettier integration',
  '- Prettier: singleQuote, trailingComma all',
  '- tsconfig: strictNullChecks true, noImplicitAny false (any is allowed)',
  '',
  '### Stack: NestJS 11 + TypeScript 5.7 + Prisma 7 + PostgreSQL',
].join('\n');

const REVIEW_INSTRUCTIONS = [
  'Read EVERY file in your assigned area. For each file, check:',
  '',
  '1. Architecture: Is code in the right layer? Module code in src/module/, background jobs in src/background/, cross-cutting in src/core/? No business logic in controllers.',
  '2. NestJS Patterns: Proper DI, decorator usage (@Public, @Roles), DTOs with class-validator, no manual instantiation of Nest-managed classes.',
  '3. Error Handling: Try-catch around external calls (DB, HTTP, RabbitMQ)? Proper use of ErrorException? No swallowed errors.',
  '4. Security: @Public() only on truly public routes? Input validated via DTOs? No secrets/hardcoded credentials? Auth checks on protected routes?',
  '5. Types: Avoid "any" where a proper type exists. Null/undefined checks (strictNullChecks is on). Proper Prisma types used.',
  '6. Data Access: All DB through PrismaService? No raw SQL? No N+1 queries? Proper use of transactions where needed.',
  '7. Async Patterns: Email and sync work through RabbitMQ? Promises handled correctly? No floating promises.',
  '8. Code Quality: Dead code, commented-out blocks, magic numbers, overly complex functions (>50 lines), inconsistent naming, missing error messages.',
  '9. Testing: Do tests exist for the module? Are tests meaningful (not just placeholder)? Critical paths covered?',
  '',
  'IMPORTANT: Skip issues that ESLint/Prettier already catches (formatting, basic lint rules).',
  'Report issues that MATTER — architectural problems, security gaps, data integrity risks, maintainability issues.',
  'Produce at most 15 findings per area. Focus on the most impactful issues.',
].join('\n');

var FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
          category: { type: 'string', enum: ['architecture', 'security', 'error-handling', 'types', 'patterns', 'performance', 'code-quality', 'testing'] },
          title: { type: 'string' },
          description: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['file', 'severity', 'category', 'title', 'description', 'suggestion'],
      },
    },
  },
  required: ['findings'],
};

var SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'object',
      properties: {
        totalFindings: { type: 'number' },
        critical: { type: 'number' },
        warning: { type: 'number' },
        info: { type: 'number' },
      },
      required: ['totalFindings', 'critical', 'warning', 'info'],
    },
    topIssues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rank: { type: 'number' },
          severity: { type: 'string' },
          title: { type: 'string' },
          files: { type: 'string' },
          description: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['rank', 'severity', 'title', 'description', 'fix'],
      },
    },
    areaBreakdown: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          findings: { type: 'number' },
          worstIssue: { type: 'string' },
        },
        required: ['area', 'findings', 'worstIssue'],
      },
    },
    overallAssessment: { type: 'string' },
  },
  required: ['summary', 'topIssues', 'areaBreakdown', 'overallAssessment'],
};

function makePrompt(areaPrompt) {
  return STANDARDS + '\n\n' + REVIEW_INSTRUCTIONS + '\n\n' + areaPrompt;
}

phase('Review');

var results = await parallel([
  function() {
    return agent(makePrompt([
      '## Your Area: Core Infrastructure',
      'Review ALL of these files:',
      '- src/main.ts',
      '- src/app.module.ts',
      '- src/app.controller.ts',
      '- src/app.service.ts',
      '- src/core/index.ts',
      '- src/core/decorator/ (ip, ispublic, roles, user decorators)',
      '- src/core/exception/ (ErrorException filter)',
      '- src/core/guard/ (auth, roles, rate-limit guards)',
      '- src/core/intercepter/ (response, logging interceptors)',
      '- src/core/logger/',
      '- src/core/middleware/',
      '- src/core/type/',
      '- src/core/interfaces/',
      '',
      'Also review root configs: tsconfig.json, tsconfig.build.json, nest-cli.json, eslint.config.mjs, .prettierrc, package.json',
      '',
      'Read each file. Check architecture, security (auth guards, rate limiting), error handling (global filter), NestJS patterns.',
    ].join('\n')), { label: 'core-infra', schema: FINDINGS_SCHEMA });
  },
  function() {
    return agent(makePrompt([
      '## Your Area: Core Business Modules',
      'Review ALL files in:',
      '- src/module/core-module/auth/ (controller, module, dto/, service/, type/)',
      '- src/module/core-module/user/ (controller, module, service, dto/)',
      '- src/module/core-module/payment/ (controller, module, sepay.service, payment.service, amount.converter, dto/, repository/)',
      '- src/module/core-module/tracking/ (controller, module, service, dto/)',
      '',
      'Read each file. Focus on: auth flow correctness, password hashing, token management, payment security, input validation in DTOs, proper use of PrismaService, error handling around external payment calls.',
    ].join('\n')), { label: 'core-modules', schema: FINDINGS_SCHEMA });
  },
  function() {
    return agent(makePrompt([
      '## Your Area: Theater Modules',
      'Review ALL files in:',
      '- src/module/theater-module/film/ (controller, module, service, dto/)',
      '- src/module/theater-module/cinema/ (controller, module, service, dto/)',
      '- src/module/theater-module/seat/ (controller, module, service, dto/)',
      '- src/module/theater-module/ticket/ (controller, module, service, dto/)',
      '',
      'Read each file. Focus on: proper NestJS CRUD patterns, DTO validation, business logic in services (not controllers), Prisma queries (no N+1), proper error handling, authorization (admin vs public routes), ticket booking logic correctness.',
    ].join('\n')), { label: 'theater-modules', schema: FINDINGS_SCHEMA });
  },
  function() {
    return agent(makePrompt([
      '## Your Area: Background Services',
      'Review ALL files in:',
      '- src/background/email/ (module, consumer, worker, service, outbox.service, constant/, templates/)',
      '- src/background/redis/ (module, service, redis.value, redis.lock.service, redis-lock.provider)',
      '- src/background/prisma/ (module, service, enum.prisma)',
      '- src/background/outbox-cron-job/ (module, service)',
      '- src/background/sync-data-cron-job/ (module, service, consumer, worker, call-movie-glu.service, type.ts, dto/)',
      '- src/background/tracking-frequent-data/ (module, service, controller, dto/)',
      '',
      'Read each file. Focus on: RabbitMQ patterns (proper message publishing/consuming), cron job reliability, Redis lock correctness, Prisma service singleton, error handling in background jobs (no unhandled rejections), outbox pattern implementation, external SDK calls error handling.',
    ].join('\n')), { label: 'background', schema: FINDINGS_SCHEMA });
  },
  function() {
    return agent(makePrompt([
      '## Your Area: Tests',
      'Review ALL files in src/test/unit/ and test/:',
      '- src/test/unit/app/',
      '- src/test/unit/background/ (email, outbox-cron-job, prisma, redis, sync-data-cron-job)',
      '- src/test/unit/core/ (decorator, exception, guard, interceptor, logger, middleware)',
      '- src/test/unit/core-module/ (auth, payment, payment/repository, user)',
      '- src/test/unit/module-definitions/',
      '- src/test/unit/theater-module/ (cinema, film, seat, ticket)',
      '- src/test/smoke.e2e-spec.ts',
      '- test/app.e2e-spec.ts',
      '- test/jest-e2e.json',
      '',
      'Read each file. Focus on: test quality (not just placeholder tests), proper mocking, edge cases covered, meaningful assertions, test isolation, async handling in tests. Check for: missing tests for critical modules, tests that always pass (no real assertions), over-mocked tests that test nothing real.',
      'Also identify which source modules lack corresponding test files.',
    ].join('\n')), { label: 'tests', schema: FINDINGS_SCHEMA });
  },
]);

phase('Synthesize');

var allFindings = results.filter(Boolean).flatMap(function(r) { return r.findings || []; });
log('Total raw findings: ' + allFindings.length);

var report = await agent([
  'You are synthesizing code review findings from 5 parallel review agents who reviewed an entire NestJS 11 backend codebase (~155 TypeScript files).',
  '',
  '## Raw Findings from All Agents',
  JSON.stringify(allFindings, null, 2),
  '',
  '## Instructions',
  '1. Deduplicate findings that refer to the same issue (keep the most detailed version)',
  '2. Group related findings into themes',
  '3. Rank the top 10-15 most critical/important issues across the entire codebase',
  '4. For each top issue, include specific file paths and fix suggestions',
  '5. Produce a per-area breakdown',
  '6. Write a concise overall assessment (2-4 sentences) of the codebase health',
  '',
  'IMPORTANT: Be specific. Every finding must reference actual files and real issues. If a finding seems vague or unsubstantiated, drop it.',
  'Produce your synthesis using the structured output format.',
].join('\n'), { phase: 'Synthesize', schema: SYNTHESIS_SCHEMA });

return { report: report, rawFindingsCount: allFindings.length };
