/**
 * Fourth-pass audit: shoots all 6 tradition landing pages so we can
 * visually verify the new palette-driven dashboard.
 *
 * Outputs land in /tmp/jx-audit4/screenshots/<slug>.png.
 */
import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/tmp/jx-audit4';
const SHOT_DIR = path.join(OUT_DIR, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const authState = JSON.stringify({
  state: {
    user: {
      id: 'audit-user-1', name: 'Audit Tester', email: 'audit@example.com',
      credits: 100, role: 'USER', preferredLanguage: 'en',
      astrologyTraditions: ['VEDIC','WESTERN','CHINESE','HELLENISTIC','HORARY','MEDICAL'],
      primaryTradition: 'VEDIC', profileComplete: true,
      dateOfBirth: '1995-06-15', timeOfBirth: '08:30',
      placeOfBirth: 'Bengaluru, India', gender: 'MALE',
    },
    accessToken: 'fake-token', refreshToken: 'fake-refresh', isAuthenticated: true,
  },
  version: 0,
});

const TRADITIONS = ['vedic', 'western', 'chinese', 'hellenistic', 'horary', 'medical'];

test.describe.serial('audit4 (tradition dashboards)', () => {
  for (const slug of TRADITIONS) {
    test(`tradition dashboard ${slug}`, async ({ page }) => {
      await installApiMocks(page, {
        'GET /health': async (r) => r.fulfill(json({ status: 'ok' })),
      });
      await page.addInitScript((a) => {
        localStorage.setItem('myastro360-auth', a);
      }, authState);
      await page.goto(`/${slug}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({ path: path.join(SHOT_DIR, `${slug}.png`), fullPage: true });
      expect(true).toBe(true);
    });
  }
});
