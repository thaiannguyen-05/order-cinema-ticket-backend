import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

// Full client flow (SePay testmode): login -> ticket -> order -> checkout
// (real SePay) -> webhook IPN (same contract as prod applyIpn) -> sync -> get.
// Run: k6 run k6/payment-smoke.js
// Env: K6_BASE_URL, K6_EMAIL, K6_PASSWORD, K6_SEPAY_SECRET

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:4000';
const seeds = JSON.parse(open('./seeds.json'));
const EMAIL = __ENV.K6_EMAIL || seeds.email || 'k6@test.local';
const PASSWORD = __ENV.K6_PASSWORD || seeds.password || 'Test1234';
const SEPAY_SECRET = __ENV.K6_SEPAY_SECRET || '';
const FIXED_TICKET = __ENV.K6_TICKET_ID || '';
// Candidate tickets: fixed one if given, else 5 random ones
// (a ticket sticks to 1 active Order, so retry on 409).
const PRICE = Number(__ENV.K6_PRICE || seeds.price || 100000);

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<5000'], // checkout calls real SePay (5s timeout)
  },
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function login() {
  const res = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'login is 200': (r) => r.status === 200 });
  const m = /accessToken=([^;]+)/.exec(res.headers['Set-Cookie'] || '');
  return m ? m[1] : '';
}

function dataOf(res) {
  try {
    const b = res.json();
    return b && b.data !== undefined ? b.data : b;
  } catch {
    return null;
  }
}

export default function () {
  const token = login();
  const auth = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Candidates: fixed ticket if given, else 5 random ones.
  const candidates = FIXED_TICKET
    ? [FIXED_TICKET]
    : Array.from({ length: 5 }, () => {
        const i = Math.floor(Math.random() * seeds.ticketIds.length);
        return seeds.ticketIds[i];
      });

  let order = null;
  let ticketId = '';
  let price = PRICE;
  for (const cand of candidates) {
    // 1. Read ticket for ground-truth price (public).
    const t = http.get(`${BASE_URL}/v1/ticket/${cand}`);
    check(t, { 'ticket is 200': (r) => r.status === 200 });
    const ticket = dataOf(t) || {};
    price = Number(ticket.price || PRICE);

    // 2. Create Order (1 Ticket -> 1 Order).
    const o = http.post(
      `${BASE_URL}/v1/payment`,
      JSON.stringify({ ticketId: cand, finalPrice: price, currency: 'VND' }),
      { headers: auth },
    );
    if (o.status === 201) {
      check(o, { 'order created 201': (r) => r.status === 201 });
      order = dataOf(o);
      ticketId = cand;
      break;
    }
    // Ticket already has an active Order (used by an older run): try next.
    console.warn(`ticket ${cand} busy (${o.status}), trying next`);
  }
  check(order, { 'order created 201': () => !!order });
  if (!order || !order.id) {
    console.error('create order failed on all candidate tickets');
    return;
  }

  // 3. Init SePay checkout (REAL testmode call, returns checkoutUrl).
  const c = http.post(
    `${BASE_URL}/v1/payment/sepay/checkout`,
    JSON.stringify({ orderId: order.id }),
    { headers: auth, timeout: '15s' },
  );
  check(c, {
    'checkout is 200/201': (r) => r.status === 200 || r.status === 201,
    'checkout form present': (r) => {
      const d = dataOf(r);
      return (
        !!d &&
        typeof d.action === 'string' &&
        d.action.includes('/v1/checkout/init') &&
        !!d.fields &&
        typeof d.fields.signature === 'string' &&
        d.fields.signature.length > 0
      );
    },
  });
  if (c.status !== 200 && c.status !== 201) {
    console.error(`checkout failed: ${c.status} ${c.body}`);
  }

  // 4. Simulate SePay IPN with the SAME wire contract prod validates
  // (header x-secret-key + ORDER_PAID/CAPTURED+APPROVED + amount match).
  // In testmode this exercises applyIpn() without moving real money.
  // Omit `customer` (optional) to skip customer_id ownership check.
  if (SEPAY_SECRET) {
    const nowS = Math.floor(Date.now() / 1000);
    const ipn = {
      timestamp: nowS,
      notification_type: 'ORDER_PAID',
      order: {
        id: uuid(),
        order_id: `sepay-${order.id.slice(0, 8)}`,
        order_status: 'CAPTURED',
        order_currency: 'VND',
        order_amount: String(price),
        order_invoice_number: order.id,
      },
      transaction: {
        id: uuid(),
        payment_method: 'BANK_TRANSFER',
        transaction_id: `txn-${Date.now()}`,
        transaction_type: 'PAYMENT',
        transaction_date: new Date().toISOString(),
        transaction_status: 'APPROVED',
        transaction_amount: String(price),
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
      },
    );
    check(w, {
      'webhook is 200': (r) => r.status === 200,
      'webhook PAID': (r) => {
        const d = dataOf(r);
        return !!d && (d.status === 'PAID' || d.status === 'FAILED');
      },
    });
  } else {
    console.warn('K6_SEPAY_SECRET not set: skipping webhook IPN step');
  }

  // 5. Poll sync + verify final status.
  const s = http.post(
    `${BASE_URL}/v1/payment/sepay/sync/${order.id}`,
    JSON.stringify({}),
    {
      headers: auth,
    },
  );
  check(s, { 'sync is 200/201': (r) => r.status === 200 || r.status === 201 });

  const g = http.get(`${BASE_URL}/v1/payment/${order.id}`, { headers: auth });
  check(g, {
    'get order is 200': (r) => r.status === 200,
    'order readable': () => !!dataOf(g),
  });

  sleep(1);
  console.log(
    `smoke done: vu=${exec.vu.idInTest} order=${order.id} ticket=${ticketId}`,
  );
}
