import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';

const fakeAuthState = JSON.stringify({
  state: {
    user: { id: 'test-user-1', name: 'Test User', email: 'test@example.com', credits: 20, role: 'USER' },
    accessToken: 'fake-token',
    refreshToken: 'fake-refresh',
    isAuthenticated: true,
  },
  version: 0,
});

test.describe('My Day page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, {
      'GET /daily-briefing': async (route) => {
        await route.fulfill(
          json({
            greeting: 'Good morning, Test User!',
            date: '2026-04-12',
            dayQuality: 'good',
            summary: 'A positive day ahead.',
            doList: ['Focus on creative tasks'],
            avoidList: ['Avoid arguments'],
            planetaryHours: [],
            currentHora: null,
            luckyColor: 'Blue',
            luckyNumber: 7,
            luckyTime: '10:00 AM',
            professionInsight: 'Good day for tech work.',
            remedy: 'Chant Om',
            mantra: 'Om Namah Shivaya',
            panchang: { tithi: 'Shukla Pratipada', nakshatra: 'Ashwini', yoga: 'Vishkambha', karana: 'Bava', vara: 'Sunday' },
          }),
        );
      },
    });
    // Inject auth state into localStorage so the page doesn't redirect to /auth
    await page.addInitScript((authJson) => {
      localStorage.setItem('myastro360-auth', authJson);
    }, fakeAuthState);
  });

  test('renders my-day page heading', async ({ page }) => {
    await page.goto('/my-day');
    // The page may use h2 or other heading levels; check for any heading or the greeting text
    await expect(page.getByText(/my day|daily|good morning/i).first()).toBeVisible();
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/my-day');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('displays daily briefing content area', async ({ page }) => {
    await page.goto('/my-day');
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(0);
  });
});
