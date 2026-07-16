/**
 * Copies the MediaPipe Tasks Vision WASM runtime from node_modules into
 * public/models/mediapipe so the hand-landmark pipeline is fully SELF-HOSTED —
 * no CDN at runtime (a third-party outage or blocked network must never break
 * palm scanning; see the geocoder incident).
 *
 * Runs via the `prebuild`/`predev` npm hooks. The WASM files are intentionally
 * NOT committed: they're copied from the installed @mediapipe/tasks-vision
 * version so the runtime always matches the JS API, and the repo stays lean.
 * The hand_landmarker.task model (7.8 MB) IS committed — it has no npm source.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Resolve the package root wherever the workspace hoisted it. The package's
// `exports` map doesn't expose package.json, so resolve the main entry
// (…/vision_bundle.mjs) and walk up to the package root.
const entry = require.resolve('@mediapipe/tasks-vision');
const wasmDir = join(dirname(entry), 'wasm');
const outDir = join(here, '..', 'public', 'models', 'mediapipe');

const FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

// The self-contained ESM bundle is also published so the Playwright E2E can
// exercise the REAL pipeline via a plain URL import (browsers can't resolve
// bare npm specifiers inside page.evaluate). The app itself imports the npm
// package; this copy exists for verification tooling.
const EXTRA = [['..', 'vision_bundle.mjs']];

mkdirSync(outDir, { recursive: true });
let copied = 0;
for (const f of FILES) {
  const src = join(wasmDir, f);
  if (!existsSync(src)) {
    console.error(`[mediapipe-assets] missing ${src} — did @mediapipe/tasks-vision install?`);
    process.exit(1);
  }
  copyFileSync(src, join(outDir, f));
  copied++;
}
for (const [rel, f] of EXTRA) {
  const src = join(wasmDir, rel, f);
  if (existsSync(src)) {
    copyFileSync(src, join(outDir, f));
    copied++;
  }
}
console.log(`[mediapipe-assets] copied ${copied} files → public/models/mediapipe`);
