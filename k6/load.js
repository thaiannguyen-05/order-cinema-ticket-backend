import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.K6_BASE_URL || 'http://host.docker.internal:4000';

// NOTE: app has a global 50 req/min throttle (ThrottlerBehindProxyGuard).
// Raise it or expect 429s when pushing VUs beyond that.
export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
};

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

export default function () {
  const pick = Math.random();

  let res;
  if (pick < 0.4) {
    res = http.get(`${BASE_URL}/health`);
  } else if (pick < 0.7) {
    res = http.post(
      `${BASE_URL}/v1/film/find`,
      JSON.stringify({ limit: 10, page: 1 }),
      JSON_HEADERS,
    );
  } else {
    res = http.post(
      `${BASE_URL}/v1/cinema/find`,
      JSON.stringify({ limit: 10, page: 1 }),
      JSON_HEADERS,
    );
  }

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
