import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { gotoAndHydrate, installApiMocks, json } from './helpers/mock-api';

/**
 * End-to-end coverage for the admin dashboard at `/admin`.
 *
 * Auth is faked by seeding the Zustand-persisted `myastro360-auth` key in
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

// ─── Phase 2 fixtures (Dashboard growth tiles + Funnel tab) ─────────────────

const stuckUsers = [
  {
    userId: 'stuck-1',
    email: 'incomplete@example.com',
    name: 'Incomplete Iris',
    createdAt: '2026-04-23T10:00:00Z',
    missing: ['birth_details'],
  },
];

const mrrSnapshot = {
  mrrUsd: 1234.56,
  arrUsd: 14814.72,
  momDelta: 0.082,
  projection6m: 18000,
  asOf: '2026-04-25',
  totalRevenueUsd: 24500.42,
  subscriberCount: 89,
  arpuUsd: 13.87,
  ltvUsd: 142.5,
};

const funnelCounts = {
  windowDays: 30,
  locale: null,
  totalSignups: 256,
  stages: [
    { stage: 'signup', count: 256, percent: 100 },
    { stage: 'profile', count: 198, percent: 77.3 },
    { stage: 'first_chat', count: 120, percent: 46.9 },
    { stage: 'paid', count: 18, percent: 7.0 },
  ],
};

const cohortRows = [
  { cohortWeek: '2026-W14', size: 60, retention: [100, 70, 55, 42] },
  { cohortWeek: '2026-W15', size: 78, retention: [100, 65, 50] },
];

const paymentFailures = [
  {
    id: 'pf-1',
    userId: 'user-1',
    userEmail: 'churn@example.com',
    userName: 'Churn Charlie',
    amount: 49900,
    currency: 'INR',
    status: 'FAILED',
    type: 'SUBSCRIPTION',
    createdAt: '2026-04-24T10:00:00Z',
  },
];

// ─── Phase 3 fixtures (Ops tab + LLM today usage) ───────────────────────────

const opsLlmHealth = {
  errorRate: [
    {
      provider: 'openai',
      total: 1234,
      errors: 12,
      errorRate: 0.0097,
      topErrors: [
        { errorCode: 'TIMEOUT', count: 8 },
        { errorCode: 'RATE_LIMIT', count: 4 },
      ],
    },
  ],
  latencyByFeature: [
    { key: 'chat', count: 800, p50: 250, p95: 1200, p99: 2400 },
  ],
  latencyByProvider: [
    { key: 'openai', count: 1234, p50: 300, p95: 1400, p99: 2900 },
  ],
  cacheHitRate: [{ feature: 'horoscope', total: 100, hits: 78, hitRate: 0.78 }],
};

const opsQueues = [
  { queue: 'briefing', waiting: 3, active: 1, delayed: 0, failed: 0, completed: 1234 },
];

const opsServiceHealth = {
  database: 'up' as const,
  redis: 'up' as const,
  details: { dbLatencyMs: 4, redisLatencyMs: 1 },
};

const capacityForecast = [
  { provider: 'openai', tpmLimit: 1_000_000, currentPeakTpm: 320_000, slopePerDay: 12_000, daysUntilHit: 56 },
];

const todayUsageByFeature = {
  chat: { tokens: 12_345, costUsd: 0.42 },
  kundli: { tokens: 4_321, costUsd: 0.11 },
};

// ─── Phase 4 fixtures (Safety, GDPR, Cost forecast) ─────────────────────────

const flaggedRows = [
  {
    id: 'flag-1',
    messageId: 'msg-1',
    userId: 'user-1',
    userEmail: 'flagger@example.com',
    userName: 'Flagger Fred',
    categories: ['hate'],
    scores: { hate: 0.92 },
    status: 'pending' as const,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-04-25T08:00:00Z',
    preview: 'this is a flagged preview',
  },
];

const gdprRows = [
  {
    id: 'gdpr-1',
    userId: 'user-1',
    userEmail: 'gdpr@example.com',
    userName: 'GDPR Greta',
    type: 'export' as const,
    status: 'pending' as const,
    dueBy: '2026-05-25T00:00:00Z',
    daysUntilDue: 30,
    fulfilledAt: null,
    adminId: null,
    note: null,
    createdAt: '2026-04-25T07:00:00Z',
  },
];

const costSummary = {
  mtdUsd: 87.42,
  prevMtdUsd: 64.10,
  projectionUsd: 125.0,
  dailyThreshold: 5,
  monthlyThreshold: 150,
};

const costByFeature = [
  { feature: 'chat', calls: 800, totalTokens: 1_234_000, costUsd: 45.2 },
];

const costByProvider = [
  { provider: 'openai', model: 'gpt-4o', calls: 800, totalTokens: 1_234_000, costUsd: 45.2 },
];

const costDaily = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-03-${String(i + 1).padStart(2, '0')}`,
  costUsd: Math.round(Math.random() * 1000) / 100,
  tokens: Math.round(Math.random() * 100_000),
}));

const costForecast = {
  points: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-04-${String(i + 1).padStart(2, '0')}`,
    actualUsd: i < 25 ? Math.round(Math.random() * 1000) / 100 : null,
    predictedUsd: i >= 25 ? Math.round(Math.random() * 1000) / 100 : null,
    lowerUsd: i >= 25 ? Math.round(Math.random() * 800) / 100 : null,
    upperUsd: i >= 25 ? Math.round(Math.random() * 1200) / 100 : null,
  })),
  level: 4.2,
  trend: 0.05,
  residualStd: 0.8,
};

/**
 * Wires up every admin endpoint the dashboard touches with deterministic
 * mocks. Tests can override individual handlers by passing an `extras`
 * map; later registrations win because `installApiMocks` walks the
 * latest map.
 */
async function installAdminMocks(page: Page, extras: Record<string, any> = {}) {
  await installApiMocks(page, {
    'GET /admin/dashboard': async (route: Route) => {
      await route.fulfill(json(dashboardStats));
    },
    'GET /admin/users': async (route: Route) => {
      await route.fulfill(json(usersPage1));
    },
    'GET /admin/users/11111111-1111-1111-1111-111111111111': async (route: Route) => {
      await route.fulfill(json(userDetailAlice));
    },
    'PUT /admin/users/11111111-1111-1111-1111-111111111111': async (route: Route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill(
        json({
          ...usersPage1.users[0],
          ...body,
        }),
      );
    },
    'DELETE /admin/users/11111111-1111-1111-1111-111111111111': async (route: Route) => {
      await route.fulfill(json({ deleted: true }));
    },
    'GET /admin/payments': async (route: Route) => {
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
    'GET /admin/chats': async (route: Route) => {
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
    'GET /admin/activity': async (route: Route) => {
      await route.fulfill(json(activityLogs));
    },
    'GET /admin/analytics': async (route: Route) => {
      await route.fulfill(json(platformAnalytics));
    },
    'GET /admin/analytics/llm-costs': async (route: Route) => {
      await route.fulfill(json(llmCosts));
    },
    'GET /admin/content/stats': async (route: Route) => {
      await route.fulfill(json(contentStats));
    },
    'GET /admin/settings': async (route: Route) => {
      const url = new URL(route.request().url());
      const prefix = url.searchParams.get('prefix') || '';
      await route.fulfill(json(settingsResponses[prefix] || {}));
    },
    'PUT /admin/settings': async (route: Route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill(json(body));
    },
    // Phase 2 — Dashboard growth tiles + Funnel tab
    'GET /admin/onboarding/stuck': async (route: Route) => {
      await route.fulfill(json(stuckUsers));
    },
    'GET /admin/mrr': async (route: Route) => {
      await route.fulfill(json(mrrSnapshot));
    },
    'GET /admin/funnel': async (route: Route) => {
      await route.fulfill(json(funnelCounts));
    },
    'GET /admin/cohorts': async (route: Route) => {
      await route.fulfill(json(cohortRows));
    },
    'GET /admin/payment-failures': async (route: Route) => {
      await route.fulfill(json(paymentFailures));
    },
    'GET /admin/churn-risk': async (route: Route) => {
      await route.fulfill(json([]));
    },
    // Phase 3 — Ops tab + LLM today usage
    'GET /admin/ops/llm-health': async (route: Route) => {
      await route.fulfill(json(opsLlmHealth));
    },
    'GET /admin/ops/queues': async (route: Route) => {
      await route.fulfill(json(opsQueues));
    },
    'GET /admin/ops/health': async (route: Route) => {
      await route.fulfill(json(opsServiceHealth));
    },
    'GET /admin/forecast/capacity': async (route: Route) => {
      await route.fulfill(json(capacityForecast));
    },
    'GET /admin/llm/usage/today': async (route: Route) => {
      await route.fulfill(json(todayUsageByFeature));
    },
    // Phase 4 — Safety, GDPR, Cost
    'GET /admin/safety/flagged': async (route: Route) => {
      await route.fulfill(json(flaggedRows));
    },
    'GET /admin/gdpr/requests': async (route: Route) => {
      await route.fulfill(json(gdprRows));
    },
    'GET /admin/cost/summary': async (route: Route) => {
      await route.fulfill(json(costSummary));
    },
    'GET /admin/cost/by-feature': async (route: Route) => {
      await route.fulfill(json(costByFeature));
    },
    'GET /admin/cost/by-provider': async (route: Route) => {
      await route.fulfill(json(costByProvider));
    },
    'GET /admin/cost/daily': async (route: Route) => {
      await route.fulfill(json(costDaily));
    },
    'GET /admin/forecast/cost': async (route: Route) => {
      await route.fulfill(json(costForecast));
    },
    ...extras,
  });
}

async function seedAdminAuth(page: Page) {
  await page.addInitScript((authJson) => {
    localStorage.setItem('myastro360-auth', authJson);
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
      localStorage.setItem('myastro360-auth', authJson);
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
    // Total Users renders without thousands separator (raw "1234"). The
    // Phase 2 MRR tile also includes "1,234" in "$1,234.56", so pin to
    // the exact KPI value instead of a fuzzy match.
    await expect(page.getByText('1234', { exact: true })).toBeVisible();
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
    // Monthly price prefilled from settings ('599'). The Pricing tab now leads
    // with report/palmistry/social fields, so anchor to the "Premium Monthly"
    // card rather than the first number input on the page.
    const monthlyInput = page
      .locator('div:has(> h4:has-text("Premium Monthly")) input[type="number"]')
      .first();
    await expect(monthlyInput).toHaveValue('599');
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
      'PUT /admin/users/11111111-1111-1111-1111-111111111111': async (route: Route) => {
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
      'PUT /admin/users/11111111-1111-1111-1111-111111111111': async (route: Route) => {
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
      'PUT /admin/settings': async (route: Route) => {
        putBody = JSON.parse(route.request().postData() || '{}');
        await route.fulfill(json(putBody));
      },
    });
    await seedAdminAuth(page);
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Pricing/ }).click();

    // Bump the monthly price input. Anchor to the "Premium Monthly" card —
    // the Pricing tab now leads with report/palmistry/social fields, so the
    // first number input on the page is no longer the monthly price.
    const monthlyInput = page
      .locator('div:has(> h4:has-text("Premium Monthly")) input[type="number"]')
      .first();
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

    // Walk every tab in the strip — order matches `tabs` in
     // apps/web/src/app/admin/page.tsx. New tabs added there should
     // be added here so the smoke loop keeps catching tabs that
     // throw on first render.
    for (const label of [
      'Funnel', 'Ops', 'Safety', 'GDPR', 'Cost',
      'Users', 'Activity', 'Payments', 'Chats',
      'Analytics', 'Pricing', 'AI Agents', 'Content',
    ]) {
      await page.getByRole('button', { name: new RegExp(label) }).first().click();
      await page.waitForTimeout(300);
    }

    expect(errors).toEqual([]);
  });

  test('dashboard endpoint failure renders a visible error with retry', async ({ page }) => {
    let calls = 0;
    await installAdminMocks(page, {
      'GET /admin/dashboard': async (route: Route) => {
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

// ─── Phase 2/3/4 tabs (Funnel, Ops, Safety, GDPR, Cost) ─────────────────────
//
// These tabs were added on main after this branch diverged. Each test
// proves both that the happy path renders something specific from the
// mocked response AND that an endpoint failure surfaces a visible
// inline error rather than a blank panel — the regression that left
// the whole dashboard looking dead in production.

test.describe('Admin dashboard — Funnel tab', () => {
  test.beforeEach(async ({ page }) => {
    await installAdminMocks(page);
    await seedAdminAuth(page);
  });

  test('renders funnel chart, cohort grid, and payment-failure rows', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Funnel/ }).click();

    // Chart, cohort table, and payment-failures table all rendered.
    await expect(page.getByTestId('funnel-chart')).toBeVisible();
    await expect(page.getByTestId('funnel-stage-signup')).toBeVisible();
    await expect(page.getByTestId('cohort-grid')).toBeVisible();
    await expect(page.getByTestId('payment-failures')).toBeVisible();
    // The "Churn Charlie" payment failure from the fixture appears in
    // the table — proves the data flowed end-to-end (not just an empty
    // shell rendered).
    await expect(page.getByText('Churn Charlie')).toBeVisible();
  });

  test('funnel endpoint failure shows visible error', async ({ page }) => {
    await installAdminMocks(page, {
      'GET /admin/funnel': async (route: Route) =>
        route.fulfill(json({ message: 'funnel offline' }, 500)),
    });
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Funnel/ }).click();

    const main = page.getByRole('main');
    await expect(main.getByText(/funnel offline/i)).toBeVisible();
  });
});

test.describe('Admin dashboard — Ops tab', () => {
  test.beforeEach(async ({ page }) => {
    await installAdminMocks(page);
    await seedAdminAuth(page);
  });

  test('renders service health, queues, error rate, latency, capacity', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Ops/ }).click();

    await expect(page.getByTestId('service-health-card')).toBeVisible();
    await expect(page.getByTestId('queue-depth-card')).toBeVisible();
    await expect(page.getByTestId('error-rate-card')).toBeVisible();
    await expect(page.getByTestId('cache-hit-card')).toBeVisible();
    await expect(page.getByTestId('capacity-card')).toBeVisible();
    // openai error-rate row from the fixture is rendered.
    await expect(page.getByTestId('error-rate-row-openai')).toBeVisible();
  });

  test('disable/enable provider posts to /admin/llm/provider/:name/:action', async ({ page }) => {
    let calledPath = '';
    await installAdminMocks(page, {
      'POST /admin/llm/provider/openai/disable': async (route: Route) => {
        calledPath = new URL(route.request().url()).pathname;
        await route.fulfill(json({ ok: true }));
      },
    });
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Ops/ }).click();
    await page.getByTestId('disable-openai').click();

    await expect.poll(() => calledPath).toMatch(/\/admin\/llm\/provider\/openai\/disable$/);
  });

  test('ops/health endpoint failure shows visible error', async ({ page }) => {
    await installAdminMocks(page, {
      'GET /admin/ops/health': async (route: Route) =>
        route.fulfill(json({ message: 'ops health offline' }, 500)),
    });
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Ops/ }).click();

    const main = page.getByRole('main');
    await expect(main.getByText(/ops health offline/i)).toBeVisible();
  });
});

test.describe('Admin dashboard — Safety tab', () => {
  test.beforeEach(async ({ page }) => {
    await installAdminMocks(page);
    await seedAdminAuth(page);
  });

  test('renders pending flagged messages with resolve actions', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Safety/ }).click();

    await expect(page.getByTestId('flagged-list')).toBeVisible();
    await expect(page.getByTestId('flagged-row-flag-1')).toBeVisible();
    // Resolve buttons appear for pending items
    await expect(page.getByTestId('resolve-approve-flag-1')).toBeVisible();
    await expect(page.getByTestId('resolve-hide-flag-1')).toBeVisible();
    await expect(page.getByTestId('resolve-actioned-flag-1')).toBeVisible();
  });

  test('approving a flagged row posts the resolve action', async ({ page }) => {
    let postedAction = '';
    await installAdminMocks(page, {
      'POST /admin/safety/flagged/flag-1/resolve': async (route: Route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        postedAction = body.action;
        await route.fulfill(json({ ok: true }));
      },
    });
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Safety/ }).click();
    await page.getByTestId('resolve-approve-flag-1').click();

    await expect.poll(() => postedAction).toBe('approve');
  });

  test('safety endpoint failure shows visible error', async ({ page }) => {
    await installAdminMocks(page, {
      'GET /admin/safety/flagged': async (route: Route) =>
        route.fulfill(json({ message: 'safety queue offline' }, 500)),
    });
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Safety/ }).click();

    const main = page.getByRole('main');
    await expect(main.getByText(/safety queue offline/i)).toBeVisible();
  });
});

test.describe('Admin dashboard — GDPR tab', () => {
  test.beforeEach(async ({ page }) => {
    await installAdminMocks(page);
    await seedAdminAuth(page);
  });

  test('renders pending GDPR requests with metadata', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /GDPR/ }).click();

    await expect(page.getByTestId('gdpr-list')).toBeVisible();
    await expect(page.getByText('GDPR Greta')).toBeVisible();
    await expect(page.getByText('gdpr@example.com')).toBeVisible();
  });

  test('gdpr endpoint failure shows visible error', async ({ page }) => {
    await installAdminMocks(page, {
      'GET /admin/gdpr/requests': async (route: Route) =>
        route.fulfill(json({ message: 'gdpr offline' }, 500)),
    });
    await gotoAdmin(page);
    await page.getByRole('button', { name: /GDPR/ }).click();

    const main = page.getByRole('main');
    await expect(main.getByText(/gdpr offline/i)).toBeVisible();
  });
});

test.describe('Admin dashboard — Cost tab', () => {
  test.beforeEach(async ({ page }) => {
    await installAdminMocks(page);
    await seedAdminAuth(page);
  });

  test('renders MTD spend, daily sparkline, top features and providers', async ({ page }) => {
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Cost/ }).click();

    await expect(page.getByText('MTD LLM Spend')).toBeVisible();
    // Headline number from costSummary fixture
    await expect(page.getByText('$87.42')).toBeVisible();
    await expect(page.getByText('Last 30 Days')).toBeVisible();
    await expect(page.getByText('Top Features (30d)')).toBeVisible();
    await expect(page.getByText('Providers & Models (30d)')).toBeVisible();
  });

  test('saving thresholds PUTs notification.cost.* settings', async ({ page }) => {
    let putBody: Record<string, string> | null = null;
    await installAdminMocks(page, {
      'PUT /admin/settings': async (route: Route) => {
        putBody = JSON.parse(route.request().postData() || '{}');
        await route.fulfill(json(putBody));
      },
    });
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Cost/ }).click();

    await page.getByRole('button', { name: /Save thresholds/i }).click();

    await expect.poll(() => putBody && Object.keys(putBody)).toEqual(
      expect.arrayContaining(['notification.cost.daily_usd', 'notification.cost.monthly_usd']),
    );
  });

  test('cost-summary failure surfaces an inline error', async ({ page }) => {
    await installAdminMocks(page, {
      'GET /admin/cost/summary': async (route: Route) =>
        route.fulfill(json({ message: 'cost summary offline' }, 500)),
    });
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Cost/ }).click();

    const main = page.getByRole('main');
    await expect(main.getByText(/cost summary offline/i)).toBeVisible();
  });
});

// ─── Dashboard tab — Phase 2 growth tiles + stuck-onboarding ────────────────

test.describe('Admin dashboard — Phase 2 widgets on Dashboard tab', () => {
  test.beforeEach(async ({ page }) => {
    await installAdminMocks(page);
    await seedAdminAuth(page);
  });

  test('shows MRR/ARR/ARPU/LTV growth tiles when /admin/mrr returns data', async ({ page }) => {
    await gotoAdmin(page);
    await expect(page.getByTestId('growth-tiles')).toBeVisible();
    await expect(page.getByText(/MRR \(USD\)/)).toBeVisible();
    await expect(page.getByText(/ARR \(USD\)/)).toBeVisible();
    await expect(page.getByText(/ARPU \(USD\)/)).toBeVisible();
    await expect(page.getByText(/LTV \(USD\)/)).toBeVisible();
  });

  test('hides growth tiles when /admin/mrr fails (graceful degrade)', async ({ page }) => {
    await installAdminMocks(page, {
      'GET /admin/mrr': async (route: Route) =>
        route.fulfill(json({ message: 'mrr offline' }, 500)),
    });
    await gotoAdmin(page);

    // The dashboard hero stats still render (Total Users etc.) but the
    // growth tiles section is absent — by design, since they're nice-
    // to-haves and shouldn't blank out the whole page.
    await expect(page.getByText('Total Users')).toBeVisible();
    await expect(page.getByTestId('growth-tiles')).toHaveCount(0);
  });

  test('shows stuck-onboarding section with users from /admin/onboarding/stuck', async ({ page }) => {
    await gotoAdmin(page);

    await expect(page.getByText(/Stuck in Onboarding/)).toBeVisible();
    await expect(page.getByText('Incomplete Iris')).toBeVisible();
    await expect(page.getByText('birth_details')).toBeVisible();
  });
});

// ─── Contract / shape-mismatch coverage ─────────────────────────────────────
//
// The previous suite proved "given a perfect mock, the page renders"
// but not "given a malformed response, the page doesn't crash". These
// tests feed shape mismatches the real backend has historically
// produced (empty arrays, `null` instead of an object, etc.) so we
// catch defensive-coding regressions that would otherwise only show
// up in production.

test.describe('Admin dashboard — defensive against malformed responses', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminAuth(page);
  });

  test('Dashboard tab survives /admin/onboarding/stuck returning an object instead of an array', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await installAdminMocks(page, {
      'GET /admin/onboarding/stuck': async (route: Route) =>
        // Backend bug: returns a single object instead of the array
        // declared by the type. Frontend is supposed to treat this as
        // "no data" and skip the section, NOT throw `stuck.map is not a function`.
        route.fulfill(json({ userId: 'oops', email: 'oops@example.com' })),
    });
    await gotoAdmin(page);

    await expect(page.getByText('Total Users')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Cost tab survives /admin/llm/usage/today returning empty object', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await installAdminMocks(page, {
      'GET /admin/llm/usage/today': async (route: Route) => route.fulfill(json({})),
    });
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Cost/ }).click();

    // Tab still renders — the "Today's Spend" tile reduces over an
    // empty object to $0.00 instead of throwing.
    await expect(page.getByText("Today's Spend")).toBeVisible();
    await expect(page.getByText(/\$0\.00/).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Ops tab survives /admin/ops/queues returning an empty list', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await installAdminMocks(page, {
      'GET /admin/ops/queues': async (route: Route) => route.fulfill(json([])),
    });
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Ops/ }).click();

    await expect(page.getByTestId('queue-depth-card')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Safety tab survives /admin/safety/flagged returning null', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await installAdminMocks(page, {
      'GET /admin/safety/flagged': async (route: Route) => route.fulfill(json(null)),
    });
    await gotoAdmin(page);
    await page.getByRole('button', { name: /Safety/ }).click();

    // The `Array.isArray` guard in SafetyTab.load lets the page render
    // the empty-state message instead of crashing on `null.map`.
    await expect(page.getByText(/No pending flagged messages/i)).toBeVisible();
    expect(errors).toEqual([]);
  });
});
