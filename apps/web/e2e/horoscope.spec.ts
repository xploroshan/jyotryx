import { test, expect } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';

test.describe('Horoscope page', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders zodiac sign heading', async ({ page }) => {
    await page.goto('/horoscope');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('displays zodiac sign selection grid', async ({ page }) => {
    await page.goto('/horoscope');
    // Should show zodiac signs like Aries, Taurus, etc.
    await expect(page.getByText(/Aries|Taurus|Gemini/i).first()).toBeVisible();
  });

  test('page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/horoscope');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
