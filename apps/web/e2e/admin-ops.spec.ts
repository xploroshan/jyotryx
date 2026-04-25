/**
 * Admin Ops tab E2E — exercises the two flows that matter most:
 *   1. The tab renders error-rate, latency, cache-hit, queue-depth,
 *      and service-health cards from a mocked `/admin/ops/*` response.
 *   2. Clicking "Disable" on a provider fires `POST /admin/llm/provider/:name/disable`
 *      and surfaces the confirmation toast.
 *
 * We mock the auth store with an ADMIN user (same pattern the Funnel
 * E2E uses) so the page renders without a real login round-trip.
 */
import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';

test.describe('Admin Ops tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const persisted = {
        state: {
          user: {
            id: 'admin-1',
            name: 'Admin',
            email: 'admin@example.com',
            phone: null,
            credits: 999,
            role: 'ADMIN',
            preferredLanguage: 'en',
            astrologyTraditions: ['VEDIC'],
            primaryTradition: 'VEDIC',
            profileComplete: true,
            dateOfBirth: '1990-01-01',
            timeOfBirth: '12:00',
            placeOfBirth: 'Mumbai',
            gender: 'Other',
          },
          accessToken: 'e2e-token',
          refreshToken: 'e2e-refresh',
          isAuthenticated: true,
        },
        version: 0,
      };
      localStorage.setItem('jyotron-auth', JSON.stringify(persisted));
    });

    let disableCalls = 0;

    await installApiMocks(page, {
      // Dashboard tab fetches — need to resolve so the admin page boots.
      'GET /admin/dashboard': async (route) => {
        await route.fulfill(json({
          totalUsers: 10, premiumUsers: 1, totalRevenue: 0,
          totalChats: 0, totalKundlis: 0, totalPayments: 0,
          newUsersToday: 0, activeSubscriptions: 0,
        }));
      },
      'GET /admin/onboarding/stuck': async (route) => { await route.fulfill(json([])); },
      'GET /admin/mrr': async (route) => {
        await route.fulfill(json({
          mrrUsd: 0, arrUsd: 0, momDelta: 0, projection6m: 0, asOf: null,
          totalRevenueUsd: 0, subscriberCount: 0, arpuUsd: 0, ltvUsd: 0,
        }));
      },
      // Ops tab fan-out.
      'GET /admin/ops/llm-health': async (route) => {
        await route.fulfill(json({
          errorRate: [
            { provider: 'openai', total: 100, errors: 10, errorRate: 0.1,
              topErrors: [{ errorCode: 'TIMEOUT', count: 6 }, { errorCode: 'RATE_LIMIT', count: 4 }] },
            { provider: 'gemini', total: 50, errors: 0, errorRate: 0, topErrors: [] },
          ],
          latencyByFeature: [
            { key: 'chat', count: 80, p50: 450, p95: 1200, p99: 2500 },
          ],
          latencyByProvider: [
            { key: 'openai', count: 90, p50: 500, p95: 1100, p99: 2300 },
          ],
          cacheHitRate: [
            { feature: 'horoscope:daily', total: 200, hits: 180, hitRate: 0.9 },
          ],
        }));
      },
      'GET /admin/ops/queues': async (route) => {
        await route.fulfill(json([
          { queue: 'report-generation', waiting: 0, active: 0, delayed: 0, failed: 0, completed: 12 },
          { queue: 'palmistry-analysis', waiting: 1, active: 0, delayed: 0, failed: 0, completed: 5 },
          { queue: 'broadcast', waiting: 0, active: 0, delayed: 0, failed: 0, completed: 3 },
        ]));
      },
      'GET /admin/ops/health': async (route) => {
        await route.fulfill(json({
          database: 'up', redis: 'up', details: { redisDbsize: 42 },
        }));
      },
      // Kill-switch endpoint — counts calls so the assertion can verify
      // the click actually fired.
      'POST /admin/llm/provider/openai/disable': async (route) => {
        disableCalls++;
        await route.fulfill(json({ enabled: false, provider: 'openai' }));
      },
    });
  });

  test('renders ops cards and handles provider disable click', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: /Ops/ }).click();

    // All four ops cards render.
    await expect(page.getByTestId('service-health-card')).toBeVisible();
    await expect(page.getByTestId('queue-depth-card')).toBeVisible();
    await expect(page.getByTestId('error-rate-card')).toBeVisible();
    await expect(page.getByTestId('cache-hit-card')).toBeVisible();

    // Queue row renders with its numbers.
    await expect(page.getByTestId('queue-depth-card')).toContainText('broadcast');
    await expect(page.getByTestId('queue-depth-card')).toContainText('palmistry-analysis');

    // OpenAI error-rate row shows the 10% figure + top errors.
    await expect(page.getByTestId('error-rate-row-openai')).toContainText('10.0%');
    await expect(page.getByTestId('error-rate-row-openai')).toContainText('TIMEOUT');

    // Clicking "Disable" fires the POST and shows the toast.
    await page.getByTestId('disable-openai').click();
    await expect(page.getByText(/openai disabled/i)).toBeVisible();
  });
});
