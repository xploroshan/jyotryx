import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, authHeaders, HEAVY_THRESHOLDS } from './config.js';

/**
 * POST /astrology/kundli — 10k RPS ramp-up load test.
 *
 * This endpoint is compute-heavy (Swiss Ephemeris + LLM interpretation),
 * so thresholds are more generous.
 *
 * Run:
 *   AUTH_TOKEN=<jwt> k6 run test/k6/astrology-kundli.js
 */
export const options = {
  scenarios: {
    kundli_ramp: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 300,
      maxVUs: 1500,
      stages: [
        { duration: '1m', target: 500 },
        { duration: '2m', target: 3000 },
        { duration: '3m', target: 10000 },
        { duration: '2m', target: 10000 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: HEAVY_THRESHOLDS,
};

const PLACES = [
  { lat: 28.6139, lng: 77.209, name: 'New Delhi' },
  { lat: 19.076, lng: 72.8777, name: 'Mumbai' },
  { lat: 12.9716, lng: 77.5946, name: 'Bengaluru' },
  { lat: 13.0827, lng: 80.2707, name: 'Chennai' },
  { lat: 22.5726, lng: 88.3639, name: 'Kolkata' },
  { lat: 23.0225, lng: 72.5714, name: 'Ahmedabad' },
];

function randomDate(start, end) {
  const s = start.getTime();
  const e = end.getTime();
  return new Date(s + Math.random() * (e - s)).toISOString().split('T')[0];
}

function randomTime() {
  const h = String(Math.floor(Math.random() * 24)).padStart(2, '0');
  const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  return `${h}:${m}`;
}

export default function () {
  const place = PLACES[Math.floor(Math.random() * PLACES.length)];
  const dob = randomDate(new Date(1950, 0, 1), new Date(2005, 11, 31));
  const tob = randomTime();

  const res = http.post(
    `${BASE_URL}/astrology/kundli`,
    JSON.stringify({
      name: `LoadTest User ${__VU}`,
      dateOfBirth: dob,
      timeOfBirth: tob,
      placeOfBirth: place,
    }),
    { headers: authHeaders() },
  );

  check(res, {
    'status is 201': (r) => r.status === 201,
    'has chartData': (r) => {
      try {
        return r.json('chartData') !== undefined;
      } catch {
        return false;
      }
    },
  });
}
