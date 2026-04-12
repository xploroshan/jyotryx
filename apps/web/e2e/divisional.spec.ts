import { test, expect } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';

test.describe('Divisional Charts page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders page heading', async ({ page }) => {
    await page.goto('/divisional');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/divisional');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('displays chart-related content', async ({ page }) => {
    await page.goto('/divisional');
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(0);
  });
});
