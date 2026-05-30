import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * REAL-API reports E2E — no mocks. Validates the generate → view → download
 * contract that was previously broken (the "Download PDF" link pointed at a
 * JSON blob and there was no in-app viewer).
 *
 * With QUEUE_ENABLED=false the API generates synchronously via the KB/template
 * fallback (no OpenAI key needed), so a generated report is immediately READY
 * with real section content.
 */

const API = () => process.env.E2E_API_BASE as string;

// Create a phone user via the real API and return an access token + a page
// with that session seeded into localStorage (the web app reads auth-store).
async function createUserAndToken(request: APIRequestContext): Promise<{ token: string; refresh: string; user: any }> {
  const phone = `+91${String(Math.floor(8_000_000_000 + Math.random() * 1_000_000_000)).slice(0, 10)}`;
  const send = await request.post(`${API()}/auth/otp/send`, { data: { phone } });
  const otp = (await send.json()).devOtp as string;
  const verify = await request.post(`${API()}/auth/otp/verify`, {
    data: { phone, otp, name: 'Report E2E User' },
  });
  expect(verify.ok()).toBeTruthy();
  const body = await verify.json();
  return { token: body.tokens.accessToken, refresh: body.tokens.refreshToken, user: body.user };
}

test.describe('Real API — reports', () => {
  test('generate → view → download a report end-to-end', async ({ page, request }) => {
    const { token, refresh, user } = await createUserAndToken(request);

    // Generate a report directly via the real API (sync path → READY).
    const gen = await request.post(`${API()}/reports/generate`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { type: 'LIFE', locale: 'en' },
    });
    expect(gen.ok(), 'report generation should succeed').toBeTruthy();

    // Seed the browser session so the reports page loads as this user.
    await page.goto('/');
    await page.evaluate(
      ([t, r, u]) => {
        localStorage.setItem(
          'myastro360-auth',
          JSON.stringify({
            state: { user: u, accessToken: t, refreshToken: r, isAuthenticated: true },
            version: 0,
          }),
        );
      },
      [token, refresh, user] as const,
    );

    await page.goto('/reports');
    // Switch to the history tab where generated reports live.
    await page.getByRole('button', { name: /My Reports/i }).click();

    // The report row renders with a working View action (not a broken PDF link).
    const viewBtn = page.getByRole('button', { name: /^View$/ });
    await expect(viewBtn.first()).toBeVisible({ timeout: 20_000 });
    await viewBtn.first().click();

    // The in-app reader opens with REAL section content from the API.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The LIFE report's first KB/fallback section heading.
    await expect(dialog.getByText(/Birth Chart Overview/i)).toBeVisible({ timeout: 15_000 });

    // Download produces a real file (a .txt built from the sections).
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: /Download/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/life.*\.txt$/i);
  });

  test('GET /reports/:id returns real section content (contract check)', async ({ request }) => {
    const { token } = await createUserAndToken(request);
    const gen = await request.post(`${API()}/reports/generate`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { type: 'CAREER', locale: 'en' },
    });
    const generated = await gen.json();

    const full = await request.get(`${API()}/reports/${generated.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(full.ok()).toBeTruthy();
    const body = await full.json();
    // The bug was that the UI had no way to read this; assert the API really
    // returns structured sections (not a JSON-string masquerading as a PDF).
    expect(Array.isArray(body.sections)).toBeTruthy();
    expect(body.sections.length).toBeGreaterThan(0);
    expect(body.sections[0]).toHaveProperty('title');
    expect(body.sections[0]).toHaveProperty('content');
  });
});
