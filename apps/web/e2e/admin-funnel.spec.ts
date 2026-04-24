/**
 * Admin Funnel tab E2E — exercises the locale filter, which is the
 * single most important workflow on the Phase 2 surface. We mock the
 * auth store so the page renders as an admin, install a catch-all
 * mock that returns distinct numbers per locale, and assert the
 * rendered stage counts change when the dropdown changes.
 */
import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';

// Fixture payloads keyed by the `locale` query param. The mock handler
// reads ?locale=… off the request URL and returns the matching shape,
// so the test doesn't have to reason about call ordering.
const FUNNEL_BY_LOCALE: Record<string, { signups: number; profileComplete: number; firstChat: number; firstPayment: number; renewal: number }> = {
  all: { signups: 1000, profileComplete: 800, firstChat: 500, firstPayment: 120, renewal: 30 },
  hi:  { signups: 400,  profileComplete: 320, firstChat: 200, firstPayment: 60,  renewal: 20 },
  en:  { signups: 500,  profileComplete: 410, firstChat: 260, firstPayment: 55,  renewal: 8  },
};

function buildFunnelPayload(locale: string) {
  const key = locale in FUNNEL_BY_LOCALE ? locale : 'all';
  const f = FUNNEL_BY_LOCALE[key];
  const frac = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 10000 : 0);
  return {
    windowDays: 30,
    locale: key === 'all' ? null : key,
    totalSignups: f.signups,
    stages: [
      { stage: 'signup',           label: 'Sign up',        count: f.signups,         conversionFromPrev: 1, conversionFromSignup: 1 },
      { stage: 'profile_complete', label: 'Profile complete', count: f.profileComplete, conversionFromPrev: frac(f.profileComplete, f.signups), conversionFromSignup: frac(f.profileComplete, f.signups) },
      { stage: 'first_chat',       label: 'First chat',      count: f.firstChat,      conversionFromPrev: frac(f.firstChat, f.profileComplete), conversionFromSignup: frac(f.firstChat, f.signups) },
      { stage: 'first_payment',    label: 'First payment',   count: f.firstPayment,   conversionFromPrev: frac(f.firstPayment, f.firstChat), conversionFromSignup: frac(f.firstPayment, f.signups) },
      { stage: 'renewal',          label: 'Renewal',         count: f.renewal,        conversionFromPrev: frac(f.renewal, f.firstPayment), conversionFromSignup: frac(f.renewal, f.signups) },
    ],
  };
}

test.describe('Admin Funnel tab', () => {
  test.beforeEach(async ({ page }) => {
    // Seed the auth store with an ADMIN user before the page bundles.
    await page.addInitScript(() => {
      // Zustand persist writes to this localStorage key. Shape must
      // match src/lib/store.ts exactly so the ProfileGate doesn't
      // redirect us back to /auth on mount.
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

    await installApiMocks(page, {
      // Admin dashboard boots into the Dashboard tab, so its fetches
      // must resolve cleanly before we even click the Funnel tab.
      'GET /admin/dashboard': async (route) => {
        await route.fulfill(json({
          totalUsers: 1000, premiumUsers: 30, totalRevenue: 50000,
          totalChats: 500, totalKundlis: 200, totalPayments: 120,
          newUsersToday: 5, activeSubscriptions: 25,
        }));
      },
      'GET /admin/onboarding/stuck': async (route) => {
        await route.fulfill(json([]));
      },
      'GET /admin/mrr': async (route) => {
        await route.fulfill(json({
          mrrUsd: 600, arrUsd: 7200, momDelta: 0.05, projection6m: 805,
          asOf: '2026-04-24T00:00:00.000Z',
          totalRevenueUsd: 600, subscriberCount: 25, arpuUsd: 24, ltvUsd: 480,
        }));
      },
      'GET /admin/funnel': async (route, req) => {
        const url = new URL(req.url());
        const locale = url.searchParams.get('locale') || 'all';
        await route.fulfill(json(buildFunnelPayload(locale)));
      },
      'GET /admin/cohorts': async (route) => {
        await route.fulfill(json([]));
      },
      'GET /admin/payment-failures': async (route) => {
        await route.fulfill(json([]));
      },
    });
  });

  test('renders the funnel and updates counts on locale change', async ({ page }) => {
    await page.goto('/admin');
    // Open the Funnel tab. The button is keyed on label, not id.
    await page.getByRole('button', { name: /Funnel/ }).click();

    // Initial render — "all locales", expect the aggregate signup count.
    await expect(page.getByTestId('funnel-chart')).toBeVisible();
    await expect(page.getByTestId('funnel-stage-signup')).toContainText('1,000');
    await expect(page.getByTestId('funnel-stage-first_payment')).toContainText('120');

    // Switch to Hindi — smaller cohort, different numbers.
    await page.getByTestId('funnel-locale').selectOption('hi');
    await expect(page.getByTestId('funnel-stage-signup')).toContainText('400');
    await expect(page.getByTestId('funnel-stage-first_payment')).toContainText('60');

    // And English — different again. Proves the mock/filter round-trip
    // actually changes the rendered numbers and the UI isn't sticky.
    await page.getByTestId('funnel-locale').selectOption('en');
    await expect(page.getByTestId('funnel-stage-signup')).toContainText('500');
    await expect(page.getByTestId('funnel-stage-first_payment')).toContainText('55');
  });
});
