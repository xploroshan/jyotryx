import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for browser-level E2E tests of the web app.
 *
 * The runner boots the real Next.js dev server (see `webServer`) and
 * exercises it in a headless Chromium. Tests intercept `**\/api/**` so
 * no backend is required — the suite is hermetic and should be runnable
 * from a fresh checkout as long as a Chromium binary is available.
 *
 * Browser resolution:
 *   - Default: Playwright looks in its own browsers cache.
 *   - Override with `PLAYWRIGHT_BROWSERS_PATH` (e.g. `/opt/pw-browsers`)
 *     when running in a sandbox that ships pre-downloaded browsers.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100',
    // NOTE: Playwright's trace recorder injects an init script into the
    // page, and in this sandbox (Next.js 15 dev mode + Chromium headless)
    // that injection races with Next's module-loader, surfacing a spurious
    // `SyntaxError: Invalid or unexpected token` pageerror that aborts
    // hydration. Keeping traces off until the race is understood. Retries
    // with `PWDEBUG=1` or `--trace=on` are still possible locally.
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Allow environments that can't download Playwright's bundled
        // Chromium (restricted outbound network) to point at a
        // pre-installed Chrome-for-Testing binary instead. Leave unset in
        // normal dev/CI and Playwright will use its own browser.
        ...(process.env.PLAYWRIGHT_CHROME_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } }
          : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 3100 --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // Point the web client at a non-routable URL so any request that
      // slips past the test's route interception fails loud instead of
      // silently hitting a real backend.
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:9/api',
      // Disable Firebase — forces the auth page to use the backend OTP
      // fallback path, which is what the tests intercept.
      NEXT_PUBLIC_FIREBASE_API_KEY: '',
    },
  },
});
