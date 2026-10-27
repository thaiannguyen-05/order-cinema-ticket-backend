import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

// Stress: ramp VUs to find the breaking point of the payment flow
// (order -> checkout form -> simulated IPN -> get). Checkout is local-only
// (signed form, no outbound call), IPN uses the same wire contract as prod.
//
// Seed first (bigger pool for stress):
//   K6_SEATS=200 K6_SHOWTIMES=10 npx ts-node prisma/seed-k6.ts  (= 2000 tickets)
// Run: k6 run k6/payment-stress.js
// Env: K6_BASE_URL, K6_EMAIL, K6_PASSWORD, K6_SEPAY_SECRET

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:4000';
const seeds = JSON.parse(open('./seeds.json'));
const EMAIL = __ENV.K6_EMAIL || seeds.email || 'k6@test.local';
const PASSWORD = __ENV.K6_PASSWORD || seeds.password || 'Test1234';
const SEPAY_SECRET = __ENV.K6_SEPAY_SECRET || '';
const TICKETS = seeds.ticketIds;
const PRICE = Number(seeds.price || 100000);

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 500 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Stress goal is observation, not gating: report, don't fail the run.
    http_req_duration: ['p(95)<3000', 'p(99)<6000'],
  },
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  if (!m) throw new Error('setup login: no accessToken cookie');
  return { token: m[1] };
}

function dataOf(res) {
  try {
    const b = res.json();
    return b && b.data !== undefined ? b.data : b;
  } catch {
    return null;
  }
}

export default function (ctx) {
  const auth = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ctx.token}`,
  };
  const ticketId = TICKETS[Math.floor(Math.random() * TICKETS.length)];

  const o = http.post(
    `${BASE_URL}/v1/payment`,
    JSON.stringify({ ticketId, finalPrice: PRICE, currency: 'VND' }),
    { headers: auth, tags: { step: 'createOrder' } },
  );
  if (o.status === 409) {
    // Ticket already consumed (pool reuse under ramp): expected, skip.
    // Sleep to keep pacing realistic and avoid a 409-only tight loop.
    sleep(1);
    return;
  }
  check(o, { 'order 201': (r) => r.status === 201 });
  const order = dataOf(o);
  if (!order || !order.id) {
    console.error(
      `ORDER status=${o.status} body=${String(o.body).slice(0, 200)}`,
    );
    return;
  }

  const c = http.post(
    `${BASE_URL}/v1/payment/sepay/checkout`,
    JSON.stringify({ orderId: order.id }),
    { headers: auth, tags: { step: 'checkout' } },
  );
  check(c, { 'checkout form': (r) => r.status === 201 || r.status === 200 });

  if (SEPAY_SECRET) {
    const clean = order.id.replace(/-/g, '');
    const ipn = {
      timestamp: Math.floor(Date.now() / 1000),
      notification_type: 'ORDER_PAID',
      order: {
        id: uuid(),
        order_id: `sepay-${clean.slice(0, 12)}`,
        order_status: 'CAPTURED',
        order_currency: 'VND',
        order_amount: String(PRICE),
        order_invoice_number: order.id,
      },
      transaction: {
        id: uuid(),
        payment_method: 'BANK_TRANSFER',
        transaction_id: `txn-${Date.now()}-${exec.vu.idInTest}-${exec.vu.iterationInInstance}`,
        transaction_type: 'PAYMENT',
        transaction_date: new Date().toISOString(),
        transaction_status: 'APPROVED',
        transaction_amount: String(PRICE),
        transaction_currency: 'VND',
      },
    };
    const w = http.post(
      `${BASE_URL}/v1/payment/sepay/webhook`,
      JSON.stringify(ipn),
      {
        headers: {
          'Content-Type': 'application/json',
          'x-secret-key': SEPAY_SECRET,
        },
        tags: { step: 'webhook' },
      },
    );
    check(w, { 'webhook 200': (r) => r.status === 200 });
  }

  if (exec.vu.iterationInInstance % 10 === 0) {
    const g = http.get(`${BASE_URL}/v1/payment/${order.id}`, {
      headers: auth,
      tags: { step: 'getOrder' },
    });
    check(g, { 'get 200': (r) => r.status === 200 });
  }

  sleep(1);
}
