import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, authHeaders, STANDARD_THRESHOLDS } from './config.js';

/**
 * POST /chat/message — 10k RPS ramp-up load test.
 *
 * Run:
 *   AUTH_TOKEN=<jwt> k6 run test/k6/chat-message.js
 */
export const options = {
  scenarios: {
    chat_ramp: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 2000,
      stages: [
        { duration: '1m', target: 1000 },
        { duration: '2m', target: 5000 },
        { duration: '3m', target: 10000 },
        { duration: '2m', target: 10000 }, // sustain
        { duration: '1m', target: 0 },      // ramp down
      ],
    },
  },
  thresholds: STANDARD_THRESHOLDS,
};

const CATEGORIES = ['kundli', 'career', 'health', 'relationship', 'wealth', 'remedy'];

const MESSAGES = [
  'What does my Mars in 7th house mean for marriage?',
  'When is the best time for a career change based on my chart?',
  'What remedies should I follow for Mangal Dosha?',
  'How does Saturn transit affect my financial prospects?',
  'What does my Rahu in the 10th house indicate?',
  'Can you analyze my current Mahadasha period?',
];

export default function () {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  const res = http.post(
    `${BASE_URL}/chat/message`,
    JSON.stringify({ message, category }),
    { headers: authHeaders() },
  );

  check(res, {
    'status is 201': (r) => r.status === 201,
    'has reply': (r) => {
      try {
        return r.json('reply') !== undefined;
      } catch {
        return false;
      }
    },
  });
}
