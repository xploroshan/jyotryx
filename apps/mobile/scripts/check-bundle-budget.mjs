/**
 * JS-bundle size budget (plan §6: "JS bundle tracked per build").
 * Run after `expo export --platform android`; sums the exported Hermes/JS
 * bundles and fails when they exceed the budget. Baseline at P6: 5.48 MB —
 * the 8 MB budget catches runaway additions (a stray heavyweight dependency),
 * not normal feature growth.
 *
 * Usage: node scripts/check-bundle-budget.mjs   (env BUNDLE_BUDGET_KB overrides)
 */
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUDGET_KB = parseInt(process.env.BUNDLE_BUDGET_KB ?? '8192', 10);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundleDir = join(root, 'dist', '_expo', 'static', 'js', 'android');

let files;
try {
  files = readdirSync(bundleDir).filter((f) => f.endsWith('.hbc') || f.endsWith('.js'));
} catch {
  console.error(`No export found at ${bundleDir} — run "npx expo export --platform android" first.`);
  process.exit(2);
}
if (files.length === 0) {
  console.error('Export directory exists but contains no bundles.');
  process.exit(2);
}

let totalBytes = 0;
for (const f of files) {
  const size = statSync(join(bundleDir, f)).size;
  totalBytes += size;
  console.log(`${f}: ${(size / 1024 / 1024).toFixed(2)} MB`);
}

const totalKB = Math.round(totalBytes / 1024);
if (totalKB > BUDGET_KB) {
  console.error(`OVER BUDGET: ${totalKB} kB > ${BUDGET_KB} kB`);
  process.exit(1);
}
console.log(`Within budget: ${totalKB} kB ≤ ${BUDGET_KB} kB`);
