import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * REAL-API feature smoke E2E — no mocks. Hits the real astrology endpoints
 * (kundli, matching, horoscope, panchang) the way the frontend does, against
 * the live API + Postgres. These features compute charts in-process (Swiss
 * Ephemeris / KP) with no external dependency, so the real results are
 * deterministic and assertable here.
 */

const API = () => process.env.E2E_API_BASE as string;

async function token(request: APIRequestContext): Promise<string> {
  const phone = `+91${String(Math.floor(8_000_000_000 + Math.random() * 1_000_000_000)).slice(0, 10)}`;
  const send = await request.post(`${API()}/auth/otp/send`, { data: { phone } });
  const otp = (await send.json()).devOtp as string;
  const verify = await request.post(`${API()}/auth/otp/verify`, { data: { phone, otp, name: 'Feature E2E' } });
  return (await verify.json()).tokens.accessToken as string;
}

// Explicit coordinates so chart computation is deterministic and needs no
// geocoding (the sandbox has no outbound network).
const BIRTH = {
  dateOfBirth: '1990-05-15',
  timeOfBirth: '14:30',
  placeOfBirth: 'Bengaluru',
  latitude: 12.9716,
  longitude: 77.5946,
};

test.describe('Real API — astrology features', () => {
  test('public pages render against the real stack', async ({ page }) => {
    // In dev mode Turbopack compiles each route on first hit, which can be
    // slow cold — allow a generous window per navigation.
    test.setTimeout(300_000);
    for (const path of ['/reports', '/horoscope', '/panchang', '/kundli', '/numerology']) {
      const res = await page.goto(path, { timeout: 180_000, waitUntil: 'domcontentloaded' });
      expect(res?.status(), `${path} should serve <400`).toBeLessThan(400);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('kundli generation returns a real chart', async ({ request }) => {
    const t = await token(request);
    const res = await request.post(`${API()}/astrology/kundli`, {
      headers: { Authorization: `Bearer ${t}` },
      data: { ...BIRTH, locale: 'en' },
    });
    expect(res.ok(), 'kundli endpoint should succeed').toBeTruthy();
    const body = await res.json();
    // A real kundli has planetary positions and an ascendant.
    const json = JSON.stringify(body).toLowerCase();
    expect(json).toMatch(/ascendant|lagna|planet|rashi|sign/);
  });

  test('horoscope returns a forecast for a sign', async ({ request }) => {
    const res = await request.get(`${API()}/astrology/horoscope/aries?period=daily&locale=en`);
    // Horoscope is public; accept 200 with content.
    expect(res.status()).toBeLessThan(400);
    const body = await res.json();
    expect(JSON.stringify(body).length).toBeGreaterThan(20);
  });

  test('matching computes a Guna Milan score', async ({ request }) => {
    const t = await token(request);
    const res = await request.post(`${API()}/astrology/matching`, {
      headers: { Authorization: `Bearer ${t}` },
      data: {
        partner1: BIRTH,
        partner2: { dateOfBirth: '1992-08-20', timeOfBirth: '09:15', placeOfBirth: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
        locale: 'en',
      },
    });
    expect(res.ok(), 'matching endpoint should succeed').toBeTruthy();
    const body = await res.json();
    expect(JSON.stringify(body).toLowerCase()).toMatch(/guna|score|koota|compatib/);
  });
});
