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
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        // Accessibility + best-practices gates. Lighthouse's a11y audit
        // covers aria-label presence, form label linkage, color contrast
        // (properly weighted for dark themes), skip-links and landmarks —
        // the bug classes that slipped past the render-only unit tests.
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3500 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
