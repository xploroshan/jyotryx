import { defineConfig, devices } from '@playwright/test';

/**
 * Full-stack REAL-API E2E config.
 *
 * Unlike playwright.config.ts (which mocks `**​/api/**` and is hermetic),
 * this config drives the entire stack with NO mocks:
 *
 *   real Chromium → real Next.js (port 3110) → real NestJS API (port 4110)
 *                 → real Postgres + Redis (ephemeral, booted in global-setup)
 *
 * global-setup boots Postgres/Redis, migrates+seeds, builds and starts the
 * API on E2E_API_PORT; the webServer below boots the web app pointed at it.
 * External services (OpenAI/Firebase/Razorpay) have no keys, so the app's
 * fallback paths run — see e2e-realapi/global-setup.ts.
 *
 * Run: `npm run test:e2e:realapi` (from apps/web).
 */

const API_PORT = process.env.E2E_API_PORT || '4110';
const WEB_PORT = process.env.E2E_WEB_PORT || '3110';
const API_BASE = `http://127.0.0.1:${API_PORT}/api`;

export default defineConfig({
  testDir: './e2e-realapi',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: require.resolve('./e2e-realapi/global-setup.ts'),
  globalTeardown: require.resolve('./e2e-realapi/global-teardown.ts'),
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHROME_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } }
          : {}),
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${WEB_PORT} --hostname 127.0.0.1`,
    // Readiness probe points at a light route: in dev, Turbopack compiles
    // per-route on first hit, and the marketing home page `/` can take >2min
    // to compile cold — which would blow the readiness window. /reports
    // compiles in seconds and proves the server is serving.
    url: `http://127.0.0.1:${WEB_PORT}/reports`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // Point the real web client at the real API booted by global-setup.
      NEXT_PUBLIC_API_URL: API_BASE,
      // Force the backend-OTP path (no Firebase keys in the sandbox), which
      // is what the phone-login spec drives end-to-end.
      NEXT_PUBLIC_FIREBASE_API_KEY: '',
    },
  },
});
