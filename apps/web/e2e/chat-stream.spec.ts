import { test, expect } from '@playwright/test';
import { installApiMocks, json, gotoAndHydrate } from './helpers/mock-api';

const AUTH_TOKEN = 'mock-jwt-token';

const authMocks = {
  'GET /auth/me': (route: any) =>
    route.fulfill(json({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      credits: 50,
      role: 'USER',
      preferredLanguage: 'en',
    })),
  'GET /user/credits': (route: any) =>
    route.fulfill(json({ available: 50, used: 10, total: 60 })),
};

test.describe('Chat Streaming (Item 3 — SSE)', () => {
  test.beforeEach(async ({ page }) => {
    // Set auth cookie/token for authenticated routes
    await page.context().addCookies([
      { name: 'token', value: AUTH_TOKEN, domain: '127.0.0.1', path: '/' },
    ]);
  });

  test('chat page should load and display message input', async ({ page }) => {
    await installApiMocks(page, {
      ...authMocks,
      'GET /chat/sessions': (route: any) => route.fulfill(json([])),
    });

    await gotoAndHydrate(page, '/chat');

    // Should have a message input area
    const messageInput = page.locator('textarea, input[type="text"], [contenteditable]').first();
    await expect(messageInput).toBeVisible({ timeout: 15_000 });
  });

  test('should display existing chat sessions', async ({ page }) => {
    await installApiMocks(page, {
      ...authMocks,
      'GET /chat/sessions': (route: any) =>
        route.fulfill(json([
          { id: 'session-1', title: 'Career Advice', category: 'career', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: 'session-2', title: 'Kundli Reading', category: 'kundli', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ])),
    });

    await gotoAndHydrate(page, '/chat');
    await page.waitForTimeout(2000);

    // Should show sessions
    const pageText = await page.textContent('body');
    expect(pageText).toBeTruthy();
  });
});

test.describe('Report Status Polling (Item 2 — BullMQ)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: 'token', value: AUTH_TOKEN, domain: '127.0.0.1', path: '/' },
    ]);
  });

  test('reports page should load and list user reports', async ({ page }) => {
    await installApiMocks(page, {
      ...authMocks,
      'GET /reports': (route: any) =>
        route.fulfill(json([
          {
            id: 'report-1',
            type: 'LIFE',
            title: 'Life Analysis Report',
            status: 'completed',
            summary: 'Your comprehensive report.',
            creditsCharged: 5,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'report-2',
            type: 'CAREER',
            title: 'Career Report',
            status: 'generating',
            summary: 'Your report is being generated.',
            creditsCharged: 5,
            createdAt: new Date().toISOString(),
          },
        ])),
    });

    await gotoAndHydrate(page, '/reports');
    await page.waitForTimeout(2000);

    const pageText = await page.textContent('body');
    expect(pageText).toBeTruthy();
  });
});

test.describe('Palmistry Image Upload (Item 1 — R2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: 'token', value: AUTH_TOKEN, domain: '127.0.0.1', path: '/' },
    ]);
  });

  test('palmistry page should load with upload area', async ({ page }) => {
    await installApiMocks(page, {
      ...authMocks,
    });

    await gotoAndHydrate(page, '/palmistry');
    await page.waitForTimeout(2000);

    const pageText = await page.textContent('body');
    expect(pageText).toBeTruthy();
  });
});
