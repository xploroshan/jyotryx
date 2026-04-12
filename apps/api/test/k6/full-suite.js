import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, authHeaders } from './config.js';

/**
 * Combined 10k RPS load test: chat (40%), kundli (30%), palmistry (30%).
 *
 * Run:
 *   AUTH_TOKEN=<jwt> k6 run test/k6/full-suite.js
 */
export const options = {
  scenarios: {
    chat: {
      executor: 'ramping-arrival-rate',
      exec: 'chatMessage',
      startRate: 40,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 800,
      stages: [
        { duration: '1m', target: 400 },
        { duration: '2m', target: 2000 },
        { duration: '3m', target: 4000 },
        { duration: '2m', target: 4000 },
        { duration: '1m', target: 0 },
      ],
    },
    kundli: {
      executor: 'ramping-arrival-rate',
      exec: 'astrologyKundli',
      startRate: 30,
      timeUnit: '1s',
      preAllocatedVUs: 150,
      maxVUs: 600,
      stages: [
        { duration: '1m', target: 300 },
        { duration: '2m', target: 1500 },
        { duration: '3m', target: 3000 },
        { duration: '2m', target: 3000 },
        { duration: '1m', target: 0 },
      ],
    },
    palmistry: {
      executor: 'ramping-arrival-rate',
      exec: 'palmistryAnalyze',
      startRate: 30,
      timeUnit: '1s',
      preAllocatedVUs: 150,
      maxVUs: 600,
      stages: [
        { duration: '1m', target: 300 },
        { duration: '2m', target: 1500 },
        { duration: '3m', target: 3000 },
        { duration: '2m', target: 3000 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<8000'],
    http_req_failed: ['rate<0.02'],
    checks: ['rate>0.98'],
  },
};

const CATEGORIES = ['kundli', 'career', 'health', 'relationship', 'wealth'];
const MESSAGES = [
  'What does my Mars in 7th house mean?',
  'When is the best time for a career change?',
  'What remedies should I follow for Mangal Dosha?',
];
const PLACES = [
  { lat: 28.6139, lng: 77.209, name: 'New Delhi' },
  { lat: 19.076, lng: 72.8777, name: 'Mumbai' },
  { lat: 12.9716, lng: 77.5946, name: 'Bengaluru' },
];

export function chatMessage() {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  const res = http.post(
    `${BASE_URL}/chat/message`,
    JSON.stringify({ message, category }),
    { headers: authHeaders() },
  );

  check(res, { 'chat 201': (r) => r.status === 201 });
}

export function astrologyKundli() {
  const place = PLACES[Math.floor(Math.random() * PLACES.length)];
  const year = 1960 + Math.floor(Math.random() * 45);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const hour = String(Math.floor(Math.random() * 24)).padStart(2, '0');
  const minute = String(Math.floor(Math.random() * 60)).padStart(2, '0');

  const res = http.post(
    `${BASE_URL}/astrology/kundli`,
    JSON.stringify({
      name: `LoadTest ${__VU}`,
      dateOfBirth: `${year}-${month}-${day}`,
      timeOfBirth: `${hour}:${minute}`,
      placeOfBirth: place,
    }),
    { headers: authHeaders() },
  );

  check(res, { 'kundli 201': (r) => r.status === 201 });
}

// Minimal 1x1 JPEG for load testing
const TINY_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]).buffer;

export function palmistryAnalyze() {
  const token = __ENV.AUTH_TOKEN || 'missing';

  const res = http.post(`${BASE_URL}/palmistry/analyze`, {
    image: http.file(TINY_JPEG, 'palm.jpg', 'image/jpeg'),
  }, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(res, { 'palmistry 202': (r) => r.status === 202 });
}
