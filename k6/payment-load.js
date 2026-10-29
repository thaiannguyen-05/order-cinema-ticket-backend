import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

// Max-throughput payment load: every iteration uses a DISTINCT ticket
// (shared-iterations => no 409 noise), full flow incl. real SePay testmode
// checkout + simulated IPN (same contract as prod).
//
// Seed first: npx ts-node prisma/seed-k6.ts  (writes k6/seeds.json, 500 tickets)
// Run: k6 run k6/payment-load.js
// Env: K6_BASE_URL, K6_EMAIL, K6_PASSWORD, K6_SEPAY_SECRET, K6_VUS, K6_ITERATIONS

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:4000';
const seeds = JSON.parse(open('./seeds.json'));
const EMAIL = __ENV.K6_EMAIL || seeds.email || 'k6@test.local';
const PASSWORD = __ENV.K6_PASSWORD || seeds.password || 'Test1234';
const SEPAY_SECRET = __ENV.K6_SEPAY_SECRET || '';
const TICKETS = seeds.ticketIds;
const PRICE = Number(seeds.price || 100000);

const VUS = Number(__ENV.K6_VUS || 50);
const ITERATIONS = Number(__ENV.K6_ITERATIONS || TICKETS.length);
const BYPASS_KEY = __ENV.K6_BYPASS_KEY || '';

function withBypass(headers) {
  return BYPASS_KEY ? { ...headers, 'x-loadtest-key': BYPASS_KEY } : headers;
}

export const options = {
  scenarios: {
    payment_max: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: ITERATIONS,
      maxDuration: '15m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<5000'], // checkout hits real SePay (5s timeout)
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
    { headers: withBypass({ 'Content-Type': 'application/json' }) },
  );
  if (res.status !== 200) {
    throw new Error(`setup login failed: ${res.status} ${res.body}`);
  }
  const m = /accessToken=([^;]+)/.exec(res.headers['Set-Cookie'] || '');
  return { token: m ? m[1] : '' };
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
  const auth = withBypass({
    'Content-Type': 'application/json',
    ...(ctx && ctx.token ? { Authorization: `Bearer ${ctx.token}` } : {}),
  });
  // Globally unique ticket per iteration => measures real max RPS, not 409s.
  const idx = exec.scenario.iterationInTest % TICKETS.length;
  const ticketId = TICKETS[idx];

  const o = http.post(
    `${BASE_URL}/v1/payment`,
    JSON.stringify({ ticketId, finalPrice: PRICE, currency: 'VND' }),
    { headers: auth, tags: { step: 'createOrder' } },
  );
  const okOrder = check(o, { 'order 201': (r) => r.status === 201 });
  const order = dataOf(o);
  if (!okOrder || !order || !order.id) {
    // Ticket reuse across runs => 409 expected; don't run downstream steps.
    check(o, {
      'order 201 or 409': (r) => r.status === 201 || r.status === 409,
    });
    if (o.status !== 409) {
      console.error(
        `ORDER status=${o.status} body=${String(o.body).slice(0, 300)}`,
      );
    }
    return;
  }

  const c = http.post(
    `${BASE_URL}/v1/payment/sepay/checkout`,
    JSON.stringify({ orderId: order.id }),
    { headers: auth, timeout: '15s', tags: { step: 'checkout' } },
  );
  check(c, {
    'checkout 200/201': (r) => r.status === 200 || r.status === 201,
    'checkout form': (r) => {
      const d = dataOf(r);
      return !!d && typeof d.action === 'string' && !!d.fields;
    },
  });

  if (SEPAY_SECRET) {
    const ipn = {
      timestamp: Math.floor(Date.now() / 1000),
      notification_type: 'ORDER_PAID',
      order: {
        id: uuid(),
        order_id: `sepay-${order.id.slice(0, 8)}`,
        order_status: 'CAPTURED',
        order_currency: 'VND',
        order_amount: String(PRICE),
        order_invoice_number: order.id,
      },
      transaction: {
        id: uuid(),
        payment_method: 'BANK_TRANSFER',
        transaction_id: `txn-${Date.now()}-${exec.scenario.iterationInTest}`,
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
        headers: withBypass({
          'Content-Type': 'application/json',
          'x-secret-key': SEPAY_SECRET,
        }),
        tags: { step: 'webhook' },
      },
    );
    check(w, { 'webhook 200': (r) => r.status === 200 });
  }

  // Light read-back on 10% of iterations to keep write pressure dominant.
  if (exec.scenario.iterationInTest % 10 === 0) {
    const g = http.get(`${BASE_URL}/v1/payment/${order.id}`, {
      headers: auth,
      tags: { step: 'getOrder' },
    });
    check(g, { 'get 200': (r) => r.status === 200 });
  }

  sleep(0.2);
}
