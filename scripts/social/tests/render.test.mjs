/**
 * Real-chromium render tests (scripts/social/lib/render.mjs): every template
 * in marketing/social/templates/*.html must render to a valid 1080x1350 PNG.
 * PLAYWRIGHT_BROWSERS_PATH is preset in the environment (/opt/pw-browsers).
 * Run: npm run social:test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderTemplate, renderSlides } from '../lib/render.mjs';
import { TEMPLATE_FIXTURES } from './helpers/fixtures.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TEMPLATES_DIR = path.join(REPO_ROOT, 'marketing/social/templates');
const RENDER_TIMEOUT_MS = 120000;

const MIN_BYTES = 20 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Assert `file` is a real PNG of exactly 1080x1350 and > 20KB. */
function assertPost1080x1350(file) {
  assert.ok(fs.existsSync(file), `${file} exists`);
  const bytes = fs.readFileSync(file);
  assert.ok(bytes.length > MIN_BYTES, `${path.basename(file)} is ${bytes.length} bytes (> 20KB expected)`);
  assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, 'PNG signature');
  // IHDR is always the first chunk: width at byte 16, height at 20 (big-endian).
  assert.equal(bytes.readUInt32BE(16), 1080, 'IHDR width');
  assert.equal(bytes.readUInt32BE(20), 1350, 'IHDR height');
}

const templates = fs
  .readdirSync(TEMPLATES_DIR)
  .filter((f) => f.endsWith('.html')) // skips _brand.css and any non-template file
  .map((f) => f.replace(/\.html$/, ''))
  .sort();

test('every template has a fixture (and vice versa)', () => {
  assert.ok(templates.length > 0, 'templates directory is not empty');
  assert.deepEqual(templates, Object.keys(TEMPLATE_FIXTURES).sort());
});

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-render-test-'));
test.after(() => fs.rmSync(outDir, { recursive: true, force: true }));

for (const name of templates) {
  const fixture = TEMPLATE_FIXTURES[name];
  const templatePath = path.join(TEMPLATES_DIR, `${name}.html`);

  if (name === 'myth-bust-carousel') {
    // Carousel template: render the 'content' variant via renderSlides,
    // which shares one browser across slides.
    test(`renders ${name} (content variant) to 1080x1350 PNG via renderSlides`, { timeout: RENDER_TIMEOUT_MS }, async () => {
      const files = await renderSlides({
        templatePath,
        slides: [fixture],
        outDir,
        baseName: name,
      });
      assert.deepEqual(files, [path.join(outDir, `${name}-01.png`)]);
      assertPost1080x1350(files[0]);
    });
  } else {
    test(`renders ${name} to 1080x1350 PNG`, { timeout: RENDER_TIMEOUT_MS }, async () => {
      const outPath = path.join(outDir, `${name}.png`);
      const rendered = await renderTemplate({ templatePath, data: fixture, outPath });
      assert.equal(rendered, outPath);
      assertPost1080x1350(outPath);
    });
  }
}
