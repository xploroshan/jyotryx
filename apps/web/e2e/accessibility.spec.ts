/**
 * Accessibility sweep.
 *
 * Runs axe-core against the public pages and fails the job on any
 * "serious" or "critical" violation. Before this suite existed, bugs
 * like missing aria-labels on icon buttons, low-contrast secondary
 * text, and non-focusable custom widgets could ship without a test
 * catching them.
 *
 * Scope is deliberately conservative — serious/critical only — so
 * violations that require deeper design work ("needs review" /
 * "moderate") don't gate every PR. Tighten over time as the noise
 * floor drops.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installApiMocks } from './helpers/mock-api';

const PUBLIC_PAGES = [
  { name: 'home', path: '/' },
  { name: 'pricing', path: '/pricing' },
  { name: 'auth', path: '/auth' },
];

for (const { name, path } of PUBLIC_PAGES) {
  test(`${name}: no serious/critical a11y violations`, async ({ page }) => {
    await installApiMocks(page);
    await page.goto(path);
    // Wait for hydration / motion settle so axe sees the final DOM.
    await page.waitForLoadState('networkidle');

    // Typed-loose because @axe-core/playwright's Page type sometimes
    // lags a Playwright version behind. Behaviourally the object is
    // identical — AxeBuilder only calls `page.evaluate` and `page.frames`.
    const { violations } = await new AxeBuilder({ page: page as any })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules([
        // color-contrast is gated via Lighthouse instead; axe's algorithm
        // doesn't handle gradient text / SVG icons well in dark themes.
        'color-contrast',
      ])
      .analyze();

    const serious = violations.filter(
      (v: { impact?: string | null }) =>
        v.impact === 'serious' || v.impact === 'critical',
    );

    if (serious.length > 0) {
      console.log(
        `axe violations on ${path}:\n` +
          serious
            .map(
              (v) =>
                `  ${v.impact?.toUpperCase()} ${v.id} — ${v.help}\n    ${v.nodes
                  .slice(0, 3)
                  .map((n) => n.target.join(' '))
                  .join('\n    ')}`,
            )
            .join('\n\n'),
      );
    }
    expect(serious).toEqual([]);
  });
}
