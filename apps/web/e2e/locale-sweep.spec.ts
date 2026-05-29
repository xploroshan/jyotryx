/**
 * 12-locale visual/overflow sweep.
 *
 * For every high-traffic route × every supported locale, at a narrow
 * (mobile) viewport where long Indic labels are most likely to break
 * layout, this:
 *   - seeds an authenticated user + the target locale into localStorage
 *   - navigates with the API mocked (no backend needed)
 *   - measures PAGE-LEVEL horizontal overflow (documentElement.scrollWidth
 *     > clientWidth) — a positive value means something isn't contained
 *     (a real layout break, distinct from an intentional overflow-x strip)
 *   - full-page screenshots it
 *
 * Output: /tmp/jx-locale-sweep/{screenshots, report.md}. Sort report by
 * overflow desc to triage the worst breaks first; only those need eyes.
 */
import { test } from '@playwright/test';
import { installApiMocks } from './helpers/mock-api';
import fs from 'fs';
import path from 'path';

const OUT = '/tmp/jx-locale-sweep';
const SHOT = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOT, { recursive: true });

const LOCALES = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as'];

const ROUTES: Array<[string, string]> = [
  ['home', '/'],
  ['my-day', '/my-day'],
  ['vedic', '/vedic'],
  ['western', '/western'],
  ['kundli', '/kundli'],
  ['horoscope', '/horoscope'],
  ['panchang', '/panchang'],
  ['matching', '/matching'],
  ['numerology', '/numerology'],
  ['tarot', '/tarot'],
  ['palmistry', '/palmistry'],
  ['muhurat', '/muhurat'],
  ['pricing', '/pricing'],
  ['kp-astrology', '/kp-astrology'],
  ['divisional', '/divisional'],
  ['reports', '/reports'],
];

const authState = JSON.stringify({
  state: {
    user: {
      id: 'sweep-user', name: 'Sweep Tester', email: 'sweep@example.com',
      phone: '+919999999999', credits: 100, role: 'USER', preferredLanguage: 'en',
      astrologyTraditions: ['VEDIC', 'WESTERN', 'CHINESE'], primaryTradition: 'VEDIC',
      profileComplete: true, dateOfBirth: '1995-06-15', timeOfBirth: '08:30',
      placeOfBirth: 'Bengaluru, India', gender: 'MALE',
    },
    accessToken: 'fake-token', refreshToken: 'fake-refresh', isAuthenticated: true,
  },
  version: 0,
});
// userSet:true stops the i18n store from overriding the seeded locale.
const localeState = (loc: string) =>
  JSON.stringify({ state: { locale: loc, userSet: true }, version: 0 });

type Row = { route: string; locale: string; overflow: number; errors: number };
const rows: Row[] = [];

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 390, height: 900 } });

// Local-only diagnostic: skip in CI so the e2e job isn't burdened with
// 192 screenshot navigations. Run it locally for the i18n/UX audit.
if (process.env.CI) {
  test.skip('locale-sweep runs locally only (see e2e/locale-sweep.spec.ts)', () => {});
} else {
for (const loc of LOCALES) {
  for (const [slug, p] of ROUTES) {
    test(`${slug} [${loc}]`, async ({ page }) => {
      const errs: string[] = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      await installApiMocks(page);
      await page.addInitScript(
        ({ a, l }) => {
          localStorage.setItem('myastro360-auth', a);
          localStorage.setItem('myastro360-locale', l);
        },
        { a: authState, l: localeState(loc) },
      );
      await page.goto(p, { waitUntil: 'load' }).catch(() => {});
      await page.waitForTimeout(1000);
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      const overflow = m.sw - m.cw;
      await page
        .screenshot({ path: path.join(SHOT, `${slug}-${loc}.png`), fullPage: true })
        .catch(() => {});
      rows.push({ route: p, locale: loc, overflow, errors: errs.length });
    });
  }
}

test.afterAll(() => {
  rows.sort((a, b) => b.overflow - a.overflow);
  const md = [
    '# Locale overflow sweep — viewport 390px',
    '',
    'Positive h-overflow = page wider than the viewport (layout break to inspect).',
    '',
    '| route | locale | h-overflow(px) | pageErrors |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.route} | ${r.locale} | ${r.overflow} | ${r.errors} |`),
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'report.md'), md);
  // eslint-disable-next-line no-console
  console.log('\n=== OVERFLOW (top 25) ===\n' + md.split('\n').slice(4, 30).join('\n'));
});
}
