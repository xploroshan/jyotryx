import { test, expect, Page } from '@playwright/test';

/**
 * REAL-API auth E2E — no mocks. Drives the actual phone-OTP flow against the
 * live NestJS API + Postgres + Redis booted by global-setup.
 *
 * The backend runs with OTP_EXPOSE_IN_RESPONSE=true, so the OTP is returned
 * in the /auth/otp/send response body. We READ that response (not mock it)
 * to learn the code, then type it like a user would. This exercises the
 * genuine create-user-by-phone, JWT issuance, and duplicate-account-matching
 * logic — the exact path where the duplicate-account bug lived.
 */

// A fresh 10-digit number per spec run so reruns don't collide on the unique
// phone constraint. Indian mobile numbers start 6–9.
function uniquePhone(): string {
  const n = String(Math.floor(8_000_000_000 + Math.random() * 1_000_000_000));
  return n.slice(0, 10);
}

// Send OTP, capturing the devOtp the backend returns in the response body.
async function sendOtpAndCaptureCode(page: Page, tenDigits: string): Promise<string> {
  const otpResponse = page.waitForResponse(
    (r) => r.url().includes('/auth/otp/send') && r.request().method() === 'POST',
  );
  await page.getByPlaceholder('Phone number').fill(tenDigits);
  await page.getByRole('button', { name: /Send OTP/i }).click();
  const res = await otpResponse;
  expect(res.status(), 'OTP send should succeed').toBe(200);
  const body = await res.json();
  expect(body.devOtp, 'backend should expose devOtp in test mode').toBeTruthy();
  return body.devOtp as string;
}

test.describe('Real API — phone OTP auth', () => {
  test('signup with a new phone creates an account and logs in', async ({ page }) => {
    const phone = uniquePhone();
    await page.goto('/auth');

    // Switch to the Sign up tab so a name is captured for the new user.
    await page.getByRole('tab', { name: 'Sign up', exact: true }).click();
    await page.getByPlaceholder(/Enter your name/i).fill('E2E Test User');

    const otp = await sendOtpAndCaptureCode(page, phone);
    await page.getByPlaceholder('6-digit OTP').fill(otp);
    await page.getByRole('button', { name: /Verify & Continue/i }).click();

    // On success the app routes away from /auth (to /my-day or
    // /profile?complete=1 for a brand-new user). Either way we leave /auth.
    await expect(page).not.toHaveURL(/\/auth$/, { timeout: 20_000 });
  });

  test('the same phone always resolves to ONE account (no duplicate)', async ({ request }) => {
    // This is the regression guard for the duplicate-account bug. Drive the
    // real verify endpoint twice for the same number and confirm a stable
    // user id — i.e. the second auth logs into the first account, it does
    // not create a second one.
    const e164 = `+91${uniquePhone()}`;
    const verify = async (name?: string): Promise<string> => {
      const send = await request.post(`${process.env.E2E_API_BASE}/auth/otp/send`, { data: { phone: e164 } });
      expect(send.status()).toBe(200);
      const code = (await send.json()).devOtp as string;
      const res = await request.post(`${process.env.E2E_API_BASE}/auth/otp/verify`, {
        data: { phone: e164, otp: code, ...(name ? { name } : {}) },
      });
      expect(res.ok()).toBeTruthy();
      return (await res.json()).user.id as string;
    };
    const id1 = await verify('First Signup');
    const id2 = await verify(); // returning login, no name
    const id3 = await verify();
    expect(id2, 'second auth must reuse the first account').toBe(id1);
    expect(id3, 'third auth must reuse the first account').toBe(id1);
  });

  test('wrong OTP is rejected by the real backend', async ({ page }) => {
    const phone = uniquePhone();
    await page.goto('/auth');
    await sendOtpAndCaptureCode(page, phone);
    await page.getByPlaceholder('6-digit OTP').fill('000000');
    await page.getByRole('button', { name: /Verify & Continue/i }).click();
    // Stays on /auth and surfaces the real backend error.
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText(/invalid otp/i)).toBeVisible({ timeout: 15_000 });
  });
});
