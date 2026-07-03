/**
 * Generate the MyAstro360 mobile app assets from the web brand mark (the
 * "shatkona-dial" LogoMark in apps/web/src/components/ui/Logo.tsx) using
 * Chromium via Playwright. Outputs real, on-brand PNGs into ../assets.
 *
 * Usage:
 *   # needs `playwright` resolvable (repo root has it via @playwright/test),
 *   # and a Chromium binary. In CI/sandbox, point at the pre-installed one:
 *   PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
 *     node apps/mobile/scripts/gen-assets.mjs
 *   # otherwise Playwright uses its managed browser (npx playwright install chromium).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '..', 'assets');

// The shatkona-dial mark as plain SVG. `color` = null → brand sunrise gradient;
// a hex → solid fill (for the white notification icon, an Android alpha mask).
function mark(color) {
  const ring = color ?? 'url(#g-ring)';
  const star = color ?? 'url(#g-star)';
  return `
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <linearGradient id="g-ring" gradientUnits="userSpaceOnUse" x1="12" y1="12" x2="88" y2="88">
        <stop offset="0" stop-color="#ffb627"/><stop offset="0.5" stop-color="#ff7a40"/><stop offset="1" stop-color="#ff4d00"/>
      </linearGradient>
      <linearGradient id="g-star" gradientUnits="userSpaceOnUse" x1="28" y1="28" x2="72" y2="72">
        <stop offset="0" stop-color="#ff7a40"/><stop offset="1" stop-color="#ff4d00"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="40" fill="none" stroke="${ring}" stroke-width="2" opacity="${color ? 1 : 0.85}"/>
    <g stroke="${ring}" stroke-width="2.4" stroke-linecap="round" opacity="${color ? 1 : 0.7}">
      <line x1="84" y1="50" x2="90" y2="50"/><line x1="79.4" y1="67" x2="84.6" y2="70"/>
      <line x1="67" y1="79.4" x2="70" y2="84.6"/><line x1="50" y1="84" x2="50" y2="90"/>
      <line x1="33" y1="79.4" x2="30" y2="84.6"/><line x1="20.6" y1="67" x2="15.4" y2="70"/>
      <line x1="16" y1="50" x2="10" y2="50"/><line x1="20.6" y1="33" x2="15.4" y2="30"/>
      <line x1="33" y1="20.6" x2="30" y2="15.4"/><line x1="50" y1="16" x2="50" y2="10"/>
      <line x1="67" y1="20.6" x2="70" y2="15.4"/><line x1="79.4" y1="33" x2="84.6" y2="30"/>
    </g>
    <path d="M50 24 L73 64 L27 64 Z" fill="none" stroke="${star}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M50 76 L27 36 L73 36 Z" fill="none" stroke="${star}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="3.6" fill="${star}"/>
  </svg>`;
}

function page({ w, h, bg, markSize, color, wordmark }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${w}px;height:${h}px;overflow:hidden}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(h * 0.03)}px;${bg}}
    .m{width:${markSize}px;height:${markSize}px}
    .w{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:${Math.round(markSize * 0.28)}px;color:#1a1410;letter-spacing:-0.02em}
    .w b{color:#ff4d00;font-weight:700}
  </style></head><body>
    <div class="m">${mark(color)}</div>
    ${wordmark ? `<div class="w">MyAstro<b>360</b></div>` : ''}
  </body></html>`;
}

const LINEN_RADIAL =
  'background:radial-gradient(circle at 50% 42%, #fbf7ec 0%, #ede4d0 55%, #e3d9c1 100%);';

const assets = [
  { file: 'icon.png', w: 1024, h: 1024, bg: LINEN_RADIAL, markSize: 640, color: null, transparent: false },
  { file: 'adaptive-icon.png', w: 1024, h: 1024, bg: 'background:transparent;', markSize: 600, color: null, transparent: true },
  { file: 'splash.png', w: 1284, h: 2778, bg: LINEN_RADIAL, markSize: 460, color: null, transparent: false, wordmark: true },
  { file: 'notification-icon.png', w: 96, h: 96, bg: 'background:transparent;', markSize: 92, color: '#ffffff', transparent: true },
];

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : {},
);
try {
  for (const a of assets) {
    const p = await browser.newPage({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: 1 });
    await p.setContent(page(a), { waitUntil: 'networkidle' });
    await p.screenshot({
      path: path.join(OUT_DIR, a.file),
      omitBackground: a.transparent,
      clip: { x: 0, y: 0, width: a.w, height: a.h },
    });
    await p.close();
    console.log(`wrote ${a.file} (${a.w}x${a.h})`);
  }
} finally {
  await browser.close();
}
