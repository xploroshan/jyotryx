/**
 * Phase 4 Safety tab E2E — loads the pending queue, clicks "Hide" on
 * a flagged row, asserts the toast fires. Mirrors the mock-api
 * scaffolding that admin-ops.spec.ts uses.
 */
import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';

test.describe('Admin Safety tab', () => {
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

    let flagged = [
      {
        id: 'flag-1',
        messageId: 'msg-1',
        userId: 'user-1',
        userEmail: 'bob@example.com',
        userName: 'Bob',
        categories: ['hate'],
        scores: { hate: 0.92, harassment: 0.05 },
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(Date.now() - 3600_000).toISOString(),
        preview: 'a possibly problematic chat message',
      },
    ];

    await installApiMocks(page, {
      // Dashboard fetches so the page can boot into its default tab.
      'GET /admin/dashboard': async (route) => {
        await route.fulfill(json({
          totalUsers: 0, premiumUsers: 0, totalRevenue: 0,
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
      // Safety tab fan-out.
      'GET /admin/safety/flagged': async (route) => {
        const url = new URL(route.request().url());
        const status = url.searchParams.get('status') || 'pending';
        await route.fulfill(json(flagged.filter((f) => f.status === status)));
      },
      'POST /admin/safety/flagged/flag-1/resolve': async (route) => {
        const body = route.request().postDataJSON() ?? {};
        flagged = flagged.map((f) =>
          f.id === 'flag-1'
            ? { ...f, status: body.action === 'hide' ? 'hidden' : body.action === 'approve' ? 'approved' : 'actioned' }
            : f,
        );
        await route.fulfill(json(flagged[0]));
      },
    });
  });

  test('lists flagged messages and resolves one via Hide', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: /Safety/ }).click();

    await expect(page.getByTestId('flagged-list')).toBeVisible();
    await expect(page.getByTestId('flagged-row-flag-1')).toContainText('bob@example.com');
    await expect(page.getByTestId('flagged-row-flag-1')).toContainText('hate');

    await page.getByTestId('resolve-hide-flag-1').click();

    // Toast confirming the action.
    await expect(page.getByText(/message hidd/i)).toBeVisible();

    // After resolution the pending list reloads and should be empty.
    await expect(page.getByText(/No pending flagged messages/i)).toBeVisible();
  });
});
