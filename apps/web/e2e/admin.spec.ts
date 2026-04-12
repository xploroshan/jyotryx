import { test, expect } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';

test.describe('Admin page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders admin page or redirects to auth', async ({ page }) => {
    await page.goto('/admin');
    // Admin page either renders content or redirects to /auth
    // Both are valid behaviors depending on auth state
    const url = page.url();
    const hasContent = (await page.textContent('body'))?.length ?? 0;
    expect(url.includes('/admin') || url.includes('/auth')).toBe(true);
    expect(hasContent).toBeGreaterThan(0);
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/admin');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
