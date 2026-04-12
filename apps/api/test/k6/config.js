/**
 * Shared k6 configuration for Jyotryx load tests.
 *
 * Usage:
 *   API_URL=https://api.jyotron.com/api AUTH_TOKEN=<jwt> k6 run test/k6/chat-message.js
 *
 * Environment variables:
 *   API_URL     — Base API URL (default: http://localhost:4000/api)
 *   AUTH_TOKEN  — Pre-generated JWT bearer token for authenticated requests
 *   OTP_PHONE   — Phone number for OTP-based auth (default: +919876543210)
 */

export const BASE_URL = __ENV.API_URL || 'http://localhost:4000/api';

/**
 * Returns authorization headers.
 * Expects AUTH_TOKEN to be set as a k6 env variable.
 */
export function authHeaders() {
  const token = __ENV.AUTH_TOKEN;
  if (!token) {
    console.warn('AUTH_TOKEN not set — requests will fail with 401');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || 'missing'}`,
  };
}

/**
 * Standard thresholds for all load tests.
 */
export const STANDARD_THRESHOLDS = {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
};

/**
 * Relaxed thresholds for compute-heavy endpoints (kundli, palmistry).
 */
export const HEAVY_THRESHOLDS = {
  http_req_duration: ['p(95)<5000', 'p(99)<10000'],
  http_req_failed: ['rate<0.02'],
  checks: ['rate>0.98'],
};
