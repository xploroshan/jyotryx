import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';

test.describe('Profile page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, {
      'GET /user/profile': async (route) => {
        await route.fulfill(
          json({
            id: 'test-user-1',
            name: 'Test User',
            email: 'test@example.com',
            phone: '+919876543210',
            credits: 20,
            role: 'USER',
            preferredLanguage: 'en',
          }),
        );
      },
    });
  });

  test('renders profile page', async ({ page }) => {
    await page.goto('/profile');
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(0);
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/profile');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
