import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.K6_BASE_URL || 'http://host.docker.internal:4000';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'health is 200': (r) => r.status === 200,
  });

  const films = http.post(
    `${BASE_URL}/v1/film/find`,
    JSON.stringify({ limit: 10, page: 1 }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(films, {
    'film/find is 200': (r) => r.status === 200,
  });

  const cinemas = http.post(
    `${BASE_URL}/v1/cinema/find`,
    JSON.stringify({ limit: 10, page: 1 }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(cinemas, {
    'cinema/find is 200': (r) => r.status === 200,
  });

  sleep(1);
}
