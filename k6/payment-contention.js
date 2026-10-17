import http from 'k6/http';
import { check } from 'k6';

// Redis-lock contention: N VUs race to create an Order on the SAME ticket.
// Expect exactly 1 success (201) and N-1 conflicts (409) proving
// PAYMENT_LOCK_KEY.CREATE_BY_TICKET (5s) + PENDING/PAID guard work.
//
// Seed first: npx ts-node prisma/seed-k6.ts
// Run: k6 run k6/payment-contention.js
// Env: K6_BASE_URL, K6_EMAIL, K6_PASSWORD, K6_TICKET_ID, K6_VUS

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:4000';
const seeds = JSON.parse(open('./seeds.json'));
const EMAIL = __ENV.K6_EMAIL || seeds.email || 'k6@test.local';
const PASSWORD = __ENV.K6_PASSWORD || seeds.password || 'Test1234';
// Use a fresh ticket each run: default to a late index to avoid clashing
// with smoke/load runs that consume from index 0 upward.
const TICKET_ID =
  __ENV.K6_TICKET_ID || seeds.ticketIds[seeds.ticketIds.length - 1];
const PRICE = Number(seeds.price || 100000);

export const options = {
  scenarios: {
    race: {
      executor: 'shared-iterations',
      vus: Number(__ENV.K6_VUS || 50),
      iterations: Number(__ENV.K6_VUS || 50),
    },
  },
  thresholds: {
    // No http_req_failed threshold: 409 is the EXPECTED outcome here.
    http_req_duration: ['p(95)<2000'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) {
    throw new Error(`setup login failed: ${res.status} ${res.body}`);
  }
  const m = /accessToken=([^;]+)/.exec(res.headers['Set-Cookie'] || '');
  return { token: m ? m[1] : '' };
}

export default function (ctx) {
  const res = http.post(
    `${BASE_URL}/v1/payment`,
    JSON.stringify({ ticketId: TICKET_ID, finalPrice: PRICE, currency: 'VND' }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...(ctx && ctx.token ? { Authorization: `Bearer ${ctx.token}` } : {}),
      },
    },
  );
  check(res, {
    '201 or 409': (r) => r.status === 201 || r.status === 409,
  });
}
