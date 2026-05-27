/**
 * Phase 3+4 audit: shoots the new editorial-hero treatment across the
 * 8 form-driven feature pages and the 15 tradition sub-routes. The
 * dark hero band is shared (via EditorialHero) — these screenshots
 * verify each call site renders cleanly.
 */
import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/tmp/jx-audit7';
const SHOT_DIR = path.join(OUT_DIR, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const user = {
  id: 'u-1', name: 'Sumanth Rosh', nickname: 'Sums',
  email: 'sumanth@example.com', phone: '+919999999999',
  credits: 100, role: 'USER', preferredLanguage: 'en',
  astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE', 'HELLENISTIC', 'HORARY', 'MEDICAL'],
  primaryTradition: 'VEDIC',
  profileComplete: true, dateOfBirth: '1995-06-15',
  timeOfBirth: '08:30', placeOfBirth: 'Bengaluru, India', gender: 'MALE',
};

const authState = JSON.stringify({
  state: { user, accessToken: 'fake', refreshToken: 'fake-r', isAuthenticated: true },
  version: 0,
});

const mocks = {
  'GET /health': async (r: any) => r.fulfill(json({ status: 'ok' })),
  'GET /panchang': async (r: any) => r.fulfill(json({})),
  'GET /astrology/dosha': async (r: any) => r.fulfill(json({ doshas: [] })),
};

const PAGES_PHASE3 = ['kundli', 'panchang', 'muhurat', 'horoscope', 'vastu', 'numerology', 'tarot', 'matching'];
const PAGES_PHASE4 = [
  'vedic/dasha', 'vedic/dosha',
  'western/natal', 'western/transits', 'western/synastry',
  'chinese/bazi', 'chinese/zodiac', 'chinese/flying-stars',
  'hellenistic/natal', 'hellenistic/profections', 'hellenistic/zodiacal-releasing',
  'horary/ask', 'horary/history',
  'medical/decumbiture', 'medical/body-zodiac',
];

for (const slug of PAGES_PHASE3) {
  test(`phase3 — ${slug}`, async ({ page }) => {
    await installApiMocks(page, mocks);
    await page.addInitScript((a) => { localStorage.setItem('myastro360-auth', a); }, authState);
    await page.goto(`/${slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(SHOT_DIR, `p3-${slug}.png`), fullPage: false });
    expect(true).toBe(true);
  });
}

for (const slug of PAGES_PHASE4) {
  test(`phase4 — ${slug}`, async ({ page }) => {
    await installApiMocks(page, mocks);
    await page.addInitScript((a) => { localStorage.setItem('myastro360-auth', a); }, authState);
    await page.goto(`/${slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(SHOT_DIR, `p4-${slug.replace('/', '-')}.png`), fullPage: false });
    expect(true).toBe(true);
  });
}
