import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoAndHydrate, installApiMocks, json } from './helpers/mock-api';

/**
 * End-to-end coverage for the admin dashboard at `/admin`.
 *
 * Auth is faked by seeding the Zustand-persisted `jyotron-auth` key in
 * localStorage with `role: 'ADMIN'`. The page guards on
 * `user?.role !== 'ADMIN'` and pushes to `/auth` otherwise, so this is
 * the documented way to land on the admin UI in tests (see
 * `apps/web/src/app/admin/page.tsx`).
 *
 * Every `/api/admin/*` endpoint the dashboard hits is mocked here so the
 * tests are hermetic and the backend doesn't have to be running.
 */
const adminAuthState = JSON.stringify({
  state: {
    user: {
      id: 'admin-user-1',
      name: 'Admin User',
      email: 'admin@example.com',
      credits: 0,
      role: 'ADMIN',
      profileComplete: true,
      preferredLanguage: 'en',
      astrologyTraditions: [],
    },
    accessToken: 'fake-admin-token',
    refreshToken: 'fake-admin-refresh',
    isAuthenticated: true,
  },
  version: 0,
});

const userAuthState = JSON.stringify({
  state: {
    user: {
      id: 'regular-user-1',
      name: 'Regular User',
      email: 'user@example.com',
      credits: 10,
      role: 'USER',
      profileComplete: true,
      preferredLanguage: 'en',
      astrologyTraditions: [],
    },
    accessToken: 'fake-user-token',
    refreshToken: 'fake-user-refresh',
    isAuthenticated: true,
  },
  version: 0,
});

const dashboardStats = {
  totalUsers: 1234,
  premiumUsers: 89,
  totalRevenue: 459900,
  totalChats: 5670,
  totalKundlis: 890,
  totalPayments: 234,
  newUsersToday: 12,
  activeSubscriptions: 67,
};

const usersPage1 = {
  users: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Alice Sharma',
      email: 'alice@example.com',
      phone: '+919999000001',
      role: 'USER',
      credits: 25,
      provider: 'phone',
      createdAt: '2026-01-15T10:00:00Z',
      subscriptionStatus: null,
      subscriptionPlan: null,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Bob Iyer',
      email: 'bob@example.com',
      phone: '+919999000002',
      role: 'PREMIUM',
      credits: 100,
      provider: 'email',
      createdAt: '2026-02-01T10:00:00Z',
      subscriptionStatus: 'ACTIVE',
      subscriptionPlan: 'MONTHLY',
    },
  ],
  total: 2,
};

const userDetailAlice = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Alice Sharma',
  email: 'alice@example.com',
  phone: '+919999000001',
  role: 'USER',
  credits: 25,
  provider: 'phone',
  gender: 'female',
  dateOfBirth: '1995-06-15',
  timeOfBirth: '08:30',
  placeOfBirth: { name: 'Mumbai, India' },
  preferredLanguage: 'en',
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-04-20T10:00:00Z',
  subscriptions: [],
  recentPayments: [],
  recentChats: [
    {
      id: 'chat-1',
      title: 'Career advice',
      category: 'career',
      messageCount: 8,
      updatedAt: '2026-04-20T10:00:00Z',
    },
  ],
  creditTransactions: [
    {
      id: 'tx-1',
      amount: 10,
      type: 'BONUS',
      description: 'Welcome bonus',
      createdAt: '2026-01-15T10:00:00Z',
    },
  ],
  reports: [],
  stats: {
    totalChats: 1,
    totalPayments: 0,
    totalSpent: 0,
    totalCreditsUsed: 5,
    kundliCharts: 1,
    palmistryReadings: 0,
    matchingResults: 0,
  },
};

const platformAnalytics = {
  sessionsToday: 156,
  sessionsLast7Days: 1023,
  avgSessionsPerDay: 146,
  avgChatLength: 7,
  creditsConsumedToday: 245,
  creditsConsumedLast7Days: 1789,
  revenueTrend: [
    { date: '2026-04-19', revenue: 4990 },
    { date: '2026-04-20', revenue: 9980 },
    { date: '2026-04-21', revenue: 1499 },
    { date: '2026-04-22', revenue: 0 },
    { date: '2026-04-23', revenue: 4990 },
    { date: '2026-04-24', revenue: 14970 },
    { date: '2026-04-25', revenue: 9980 },
  ],
  featureUsage: [
    { feature: 'chat', count: 4567, percent: 60 },
    { feature: 'kundli', count: 1234, percent: 16 },
    { feature: 'horoscope', count: 890, percent: 12 },
  ],
  conversionRate: 7.2,
  retention: { day1: 65, day7: 38, day30: 22 },
  llmTotals: {
    callsLast7Days: 9876,
    totalCostUsdLast7Days: 12.345,
    totalTokensLast7Days: 4_567_890,
  },
};

const llmCosts = [
  {
    userId: 'top-user-1',
    userName: 'Top User',
    userEmail: 'top@example.com',
    calls: 250,
    totalTokens: 312_450,
    totalCostUsd: 0.7811,
  },
];

const contentStats = {
  knowledgeDocuments: 4567,
  knowledgeCategories: [
    { category: 'planets', count: 980 },
    { category: 'houses', count: 432 },
  ],
  tarotReadings: 234,
  kundliCharts: 890,
  reports: 156,
  palmistryReadings: 78,
  matchingResults: 245,
  chatSessions: 5670,
  notifications: 1230,
};

const activityLogs = {
  logs: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      adminId: 'admin-user-1',
      adminEmail: 'admin@example.com',
      action: 'USER_UPDATE',
      entityType: 'User',
      entityId: '11111111-1111-1111-1111-111111111111',
      entityLabel: 'Alice Sharma',
      previousData: { credits: 25 },
      newData: { credits: 50 },
      undone: false,
      undoneAt: null,
      createdAt: '2026-04-25T09:00:00Z',
    },
  ],
  total: 1,
};

const settingsResponses: Record<string, Record<string, string>> = {
  'pricing.': {
    'pricing.monthly.price': '599',
    'pricing.annual.price': '5999',
    'pricing.credits.starter.credits': '25',
    'pricing.credits.starter.price': '99',
    'pricing.credits.popular.credits': '75',
    'pricing.credits.popular.price': '249',
    'pricing.credits.pro.credits': '200',
    'pricing.credits.pro.price': '599',
  },
  'llm.': {
    'llm.default.provider': 'openai',
    'llm.default.model': 'gpt-4o',
    'llm.default.temperature': '0.7',
    'llm.openai.enabled': 'true',
    'llm.openai.key': 'sk-fake-openai',
  },
};

/**
 * Wires up every admin endpoint the dashboard touches with deterministic
 * mocks. Tests can override individual handlers by passing an `extras`
 * map; later registrations win because `installApiMocks` walks the
 * latest map.
 */
async function installAdminMocks(page: Page, extras: Record<string, any> = {}) {
  await installApiMocks(page, {
    'GET /admin/dashboard': async (route) => {
      await route.fulfill(json(dashboardStats));
    },
    'GET /admin/users': async (route) => {
      await route.fulfill(json(usersPage1));
    },
    'GET /admin/users/11111111-1111-1111-1111-111111111111': async (route) => {
      await route.fulfill(json(userDetailAlice));
    },
    'PUT /admin/users/11111111-1111-1111-1111-111111111111': async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill(
        json({
          ...usersPage1.users[0],
          ...body,
        }),
      );
    },
    'DELETE /admin/users/11111111-1111-1111-1111-111111111111': async (route) => {
      await route.fulfill(json({ deleted: true }));
    },
    'GET /admin/payments': async (route) => {
      await route.fulfill(
        json([
          {
            id: 'pay-1',
            userName: 'Alice Sharma',
            userEmail: 'alice@example.com',
            amount: 49900,
            status: 'COMPLETED',
            type: 'SUBSCRIPTION',
            createdAt: '2026-04-25T09:00:00Z',
          },
        ]),
      );
    },
    'GET /admin/chats': async (route) => {
      await route.fulfill(
        json([
          {
            id: 'chat-1',
            userName: 'Alice Sharma',
            userEmail: 'alice@example.com',
            title: 'Career advice',
            category: 'career',
            messageCount: 8,
            updatedAt: '2026-04-25T09:00:00Z',
          },
        ]),
      );
    },
    'GET /admin/activity': async (route) => {
      await route.fulfill(json(activityLogs));
    },
    'GET /admin/analytics': async (route) => {
      await route.fulfill(json(platformAnalytics));
    },
    'GET /admin/analytics/llm-costs': async (route) => {
      await route.fulfill(json(llmCosts));
    },
    'GET /admin/content/stats': async (route) => {
      await route.fulfill(json(contentStats));
    },
    'GET /admin/settings': async (route) => {
      const url = new URL(route.request().url());
      const prefix = url.searchParams.get('prefix') || '';
      await route.fulfill(json(settingsResponses[prefix] || {}));
    },
    'PUT /admin/settings': async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill(json(body));
    },
    ...extras,
  });
}

async function seedAdminAuth(page: Page) {
  await page.addInitScript((authJson) => {
    localStorage.setItem('jyotron-auth', authJson);
  }, adminAuthState);
}

/**
 * Navigate to /admin and wait until the dashboard shell is fully
 * rendered. The page returns `null` until Zustand rehydrates the
 * persisted auth state, so a click on a tab issued immediately after
 * `goto` lands on a button that hasn't been mounted yet. Waiting for
 * the "Admin Dashboard" heading is the cheapest reliable signal that
 * hydration has completed and the tab buttons are bound.
 */
async function gotoAdmin(page: Page) {
  await gotoAndHydrate(page, '/admin');
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({
    timeout: 15_000,
  });
}

// ─── Auth gating ────────────────────────────────────────────────────────────

test.describe('Admin dashboard — auth gating', () => {
  test('redirects unauthenticated users to /auth', async ({ page }) => {
    await installAdminMocks(page);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
  });

  test('redirects non-admin users to /auth', async ({ page }) => {
    await installAdminMocks(page);
    await page.addInitScript((authJson) => {
      localStorage.setItem('jyotron-auth', authJson);
    }, userAuthState);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
  });

  test('admin role lands on the dashboard', async ({ page }) => {
    await installAdminMocks(page);
    await seedAdminAuth(page);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await expect(page.getByText(/Logged in as/i)).toBeVisible();
  });
});

// ─── Tab navigation + content rendering ─────────────────────────────────────

test.describe('Admin dashboard — tabs', () => {
  test.beforeEach(async ({ page }) => {
    await installAdminMocks(page);
    await seedAdminAuth(page);
  });

  test('Dashboard tab renders KPI cards from /admin/dashboard', async ({ page }) => {
    await gotoAdmin(page);

    await expect(page.getByText('Total Users')).toBeVisible();
    // 1234 is rendered without thousands separator; use a flexible match.
    await expect(page.getByText(/1,?234/)).toBeVisible();
    await expect(page.getByText('Premium Users')).toBeVisible();
    await expect(page.getByText('New Today')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();
  });

  test('Users tab loads /admin/users and shows the table', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Users/ }).first().click();

    await expect(page.getByText('2 users total')).toBeVisible();
    await expect(page.getByText('Alice Sharma')).toBeVisible();
    await expect(page.getByText('alice@example.com')).toBeVisible();
    await expect(page.getByText('Bob Iyer')).toBeVisible();
  });

  test('Activity tab loads /admin/activity and shows logs', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Activity/ }).click();

    await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
    await expect(page.getByText('1 total actions recorded')).toBeVisible();
    await expect(page.getByText('User Updated')).toBeVisible();
    await expect(page.getByText('Alice Sharma')).toBeVisible();
  });

  test('Payments tab loads /admin/payments and shows the table', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Payments/ }).click();

    // Wait for the row from the mocked /admin/payments response.
    await expect(page.getByText('Alice Sharma')).toBeVisible();
    await expect(page.getByText('SUBSCRIPTION')).toBeVisible();
  });

  test('Chats tab loads /admin/chats and shows the table', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Chats/ }).click();

    await expect(page.getByText('Career advice')).toBeVisible();
    await expect(page.getByText(/career/)).toBeVisible();
  });

  test('Analytics tab loads /admin/analytics and renders charts', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Analytics/ }).click();

    await expect(page.getByRole('heading', { name: 'Platform Analytics' })).toBeVisible();
    await expect(page.getByText('Sessions Today')).toBeVisible();
    await expect(page.getByText(/156/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'LLM Cost Per User' })).toBeVisible();
    await expect(page.getByText('Top User')).toBeVisible();
  });

  test('Pricing tab loads /admin/settings and prefills inputs', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Pricing/ }).click();

    await expect(page.getByRole('heading', { name: 'Pricing Management' })).toBeVisible();
    // Monthly price prefilled from settings ('599').
    await expect(page.locator('input[type="number"]').first()).toHaveValue('599');
  });

  test('AI Agents tab loads /admin/settings?prefix=llm. and shows providers', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /AI Agents/ }).click();

    await expect(page.getByRole('heading', { name: /AI.*LLM Management/ })).toBeVisible();
    await expect(page.getByText('Global Defaults')).toBeVisible();
    // The provider card uses a span (not a heading) for its label, so we
    // pin to the dedicated "API Key" label text whose only call site is
    // the per-provider card. If this disappears the providers grid has
    // failed to render even when /admin/settings returned data.
    await expect(page.getByText('API Key').first()).toBeVisible();
  });

  test('Content tab loads /admin/content/stats and shows counts', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Content/ }).click();

    await expect(page.getByRole('heading', { name: 'Content Management' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Knowledge Base', exact: true })).toBeVisible();
    // 4567 rendered with thousands separator
    await expect(page.getByText(/4,567/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Knowledge Base by Category' })).toBeVisible();
  });
});

// ─── Drilldown + write actions ──────────────────────────────────────────────

test.describe('Admin dashboard — Users drilldown', () => {
  test.beforeEach(async ({ page }) => {
    await installAdminMocks(page);
    await seedAdminAuth(page);
  });

  test('clicking a user opens detail panel with stats', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Users/ }).first().click();

    await page.getByText('Alice Sharma').click();
    // Detail panel shows the user's birth city from /admin/users/:id
    await expect(page.getByText('Mumbai, India')).toBeVisible();
    // Sub-tabs labelled with counts from the mocked detail response
    await expect(page.getByRole('button', { name: /Chats \(1\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Credits \(1\)/ })).toBeVisible();
  });

  test('Edit modal saves credits via PUT /admin/users/:id', async ({ page }) => {
    let putBody: any = null;
    await installAdminMocks(page, {
      'PUT /admin/users/11111111-1111-1111-1111-111111111111': async (route) => {
        putBody = JSON.parse(route.request().postData() || '{}');
        await route.fulfill(json({ ...usersPage1.users[0], credits: putBody.credits }));
      },
    });
    await seedAdminAuth(page);
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Users/ }).first().click();
    await page.getByText('Alice Sharma').click();

    // The "Credits (1)" tab in the user-detail panel matches a loose
    // "Edit" regex, so pin to an exact match.
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const creditsInput = page.locator('input[type="number"]').last();
    await creditsInput.fill('99');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText('User updated successfully')).toBeVisible();
    expect(putBody?.credits).toBe(99);
  });

  test('quick role change posts PUT /admin/users/:id with new role', async ({ page }) => {
    let putBody: any = null;
    await installAdminMocks(page, {
      'PUT /admin/users/11111111-1111-1111-1111-111111111111': async (route) => {
        putBody = JSON.parse(route.request().postData() || '{}');
        await route.fulfill(json({ ...usersPage1.users[0], role: putBody.role }));
      },
    });
    await seedAdminAuth(page);
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Users/ }).first().click();

    // The role <select> in the row is the first such control inside the table.
    const aliceRow = page.locator('tr', { hasText: 'Alice Sharma' });
    await aliceRow.locator('select').selectOption('PREMIUM');

    await expect.poll(() => putBody?.role).toBe('PREMIUM');
  });
});

// ─── Pricing write path ─────────────────────────────────────────────────────

test.describe('Admin dashboard — Pricing save', () => {
  test('PUT /admin/settings is called with merged pricing payload', async ({ page }) => {
    let putBody: Record<string, string> | null = null;
    await installAdminMocks(page, {
      'PUT /admin/settings': async (route) => {
        putBody = JSON.parse(route.request().postData() || '{}');
        await route.fulfill(json(putBody));
      },
    });
    await seedAdminAuth(page);
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Pricing/ }).click();

    // Bump the monthly price input.
    const monthlyInput = page.locator('input[type="number"]').first();
    await monthlyInput.fill('799');

    await page.getByRole('button', { name: /Save Pricing/ }).click();
    await expect(page.getByText(/Pricing updated successfully/i)).toBeVisible();

    expect(putBody?.['pricing.monthly.price']).toBe('799');
    // Other pricing keys must be preserved on save (regression: a bug
    // would drop them and reset all credit-pack pricing on every save).
    expect(putBody?.['pricing.annual.price']).toBe('5999');
    expect(putBody?.['pricing.credits.starter.credits']).toBe('25');
  });
});

// ─── Resilience ─────────────────────────────────────────────────────────────

test.describe('Admin dashboard — error resilience', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminAuth(page);
  });

  test('renders without JS errors on every tab', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await installAdminMocks(page);
    await gotoAdmin(page);

    for (const label of ['Users', 'Activity', 'Payments', 'Chats', 'Analytics', 'Pricing', 'AI Agents', 'Content']) {
      await page.getByRole('button', { name: new RegExp(label) }).first().click();
      await page.waitForTimeout(300);
    }

    expect(errors).toEqual([]);
  });

  test('dashboard endpoint failure renders a visible error with retry', async ({ page }) => {
    let calls = 0;
    await installAdminMocks(page, {
      'GET /admin/dashboard': async (route) => {
        calls += 1;
        if (calls === 1) {
          await route.fulfill(json({ message: 'dashboard offline' }, 500));
        } else {
          await route.fulfill(json(dashboardStats));
        }
      },
    });
    await gotoAdmin(page);

    // Header + tab strip render even when the dashboard fetch fails…
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Users/ }).first()).toBeVisible();
    // …AND the body of the Dashboard tab surfaces the failure instead of
    // silently rendering a blank panel (regression: every admin tab used
    // to do `try { ... } catch {}` and return null on error). Scope to
    // <main> because Next 15 dev mode also injects an error overlay
    // containing the same diagnostic text.
    const main = page.getByRole('main');
    await expect(main.getByText('Failed to load this tab')).toBeVisible();
    await expect(main.getByText('dashboard offline')).toBeVisible();

    // Retry succeeds with the mock's second response.
    await main.getByRole('button', { name: 'Retry' }).click();
    await expect(main.getByText('Total Users')).toBeVisible();
  });

  test('every other tab surfaces its own fetch failure', async ({ page }) => {
    // Every admin endpoint returns 500 except /admin/dashboard, so the
    // initial load succeeds and we can drive each tab from the strip.
    const fail = (msg: string) => async (route: any) =>
      route.fulfill(json({ message: msg }, 500));
    await installAdminMocks(page, {
      'GET /admin/users': fail('users offline'),
      'GET /admin/activity': fail('activity offline'),
      'GET /admin/payments': fail('payments offline'),
      'GET /admin/chats': fail('chats offline'),
      'GET /admin/analytics': fail('analytics offline'),
      'GET /admin/analytics/llm-costs': fail('llm-costs offline'),
      'GET /admin/content/stats': fail('content offline'),
      'GET /admin/settings': fail('settings offline'),
    });
    await gotoAdmin(page);

    // Each tab should render TabError ("Failed to load this tab") with
    // the server's diagnostic, not a blank panel.
    const cases: Array<{ label: string; needle: RegExp }> = [
      { label: 'Activity', needle: /activity offline/ },
      { label: 'Analytics', needle: /(analytics|llm-costs) offline/ },
      { label: 'Content', needle: /content offline/ },
      { label: 'AI Agents', needle: /settings offline/ },
    ];
    for (const { label, needle } of cases) {
      await page.getByRole('button', { name: new RegExp(label) }).first().click();
      await expect(
        page.getByText('Failed to load this tab').first(),
      ).toBeVisible();
      await expect(page.getByText(needle).first()).toBeVisible();
    }
  });
});
