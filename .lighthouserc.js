// Lighthouse assertions run per-URL (not averaged) when `url` lists multiple
// entries. Each URL added here is individually gated — a regression on a
// single page fails the job even if the others are fine. Keep this list in
// sync with the KB-backed surfaces in `apps/web/budget.json`.
const GATED_URLS = [
  'http://localhost:3000',
  'http://localhost:3000/my-day',
  'http://localhost:3000/panchang',
  'http://localhost:3000/kundli',
  'http://localhost:3000/numerology',
  'http://localhost:3000/vedic',
  'http://localhost:3000/western',
  'http://localhost:3000/chinese',
  'http://localhost:3000/hellenistic',
  'http://localhost:3000/horary',
  'http://localhost:3000/medical',
  // Programmatic SEO surfaces — statically generated, so they don't flake;
  // gating one of each template guards the whole cluster (12 signs, ~100
  // city pages, 600+ locale pages share these three templates).
  'http://localhost:3000/horoscope/aries',
  'http://localhost:3000/panchang/varanasi',
  'http://localhost:3000/hi/kundli',
];

module.exports = {
  ci: {
    collect: {
      url: GATED_URLS,
      startServerCommand: 'npm run start --workspace=apps/web',
      startServerReadyPattern: 'Ready in',
      numberOfRuns: 3,
    },
    assert: {
      // Two tiers via assertMatrix (a plain `assertions` object can't hold
      // the same audit key twice — the second would silently overwrite the
      // first). Both entries match every URL.
      assertMatrix: [
        {
          // ERROR TIER — regression guards, not perf targets, tuned so a
          // normal run can never trip them (see history in git blame): the
          // throttle-sensitive metrics use OPTIMISTIC aggregation (best of 3
          // runs must clear the bar) so only a sustained regression fails.
          // CLS stays strict + median: layout stability is deterministic.
          matchingUrlPattern: '.*',
          assertions: {
            'categories:accessibility': ['error', { minScore: 0.9 }],
            'categories:performance': ['error', { minScore: 0.65, aggregationMethod: 'optimistic' }],
            'first-contentful-paint': ['error', { maxNumericValue: 3000, aggregationMethod: 'optimistic' }],
            'largest-contentful-paint': ['error', { maxNumericValue: 6500, aggregationMethod: 'optimistic' }],
            'total-blocking-time': ['error', { maxNumericValue: 600, aggregationMethod: 'optimistic' }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
          },
        },
        {
          // WARN TIER at Google's "good" field band: never fails the job, but
          // surfaces drift in every PR's report instead of only when the
          // loose error tier finally trips. Ratchet the error tier toward
          // these once the SSR/variable-font work has soaked in production.
          matchingUrlPattern: '.*',
          assertions: {
            'categories:best-practices': ['warn', { minScore: 0.9 }],
            'categories:performance': ['warn', { minScore: 0.9, aggregationMethod: 'optimistic' }],
            'first-contentful-paint': ['warn', { maxNumericValue: 1800, aggregationMethod: 'optimistic' }],
            'largest-contentful-paint': ['warn', { maxNumericValue: 2500, aggregationMethod: 'optimistic' }],
            'total-blocking-time': ['warn', { maxNumericValue: 300, aggregationMethod: 'optimistic' }],
          },
        },
      ],
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
