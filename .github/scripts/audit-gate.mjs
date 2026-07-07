// Production dependency audit gate with a scoped, documented allowlist.
//
// Runs `npm audit --omit=dev` and fails CI on any high/critical advisory
// EXCEPT a small allowlist of advisories that are transitive through an
// upstream dependency we cannot bump on our own. The allowlist is keyed by the
// advisory URL, so a DIFFERENT (new) advisory — even on the same package —
// still fails the gate. This keeps the security signal meaningful instead of
// loosening `--audit-level` to `critical` and going blind to real highs.
import { execSync } from 'node:child_process';

// Advisories we knowingly accept, with the reason and the condition to remove.
// Keyed by GHSA URL.
const ALLOWLIST = new Map([
  [
    'https://github.com/advisories/GHSA-72gw-mp4g-v24j',
    'multer DoS (deeply nested field names). Patched in multer 2.2.0, but ' +
      '@nestjs/platform-express@11 hard-pins multer to exactly 2.1.1, so we ' +
      'cannot resolve it without forking NestJS. Remove once @nestjs/' +
      'platform-express ships a release depending on multer >= 2.2.0.',
  ],
  [
    'https://github.com/advisories/GHSA-3p4h-7m6x-2hcm',
    'multer DoS (incomplete cleanup of aborted uploads). Same pinned-upstream ' +
      'constraint as GHSA-72gw-mp4g-v24j; removed together.',
  ],
]);

let raw = '';
try {
  raw = execSync('npm audit --omit=dev --json', {
    maxBuffer: 1e8,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();
} catch (e) {
  // `npm audit` exits non-zero whenever advisories exist; the JSON report is
  // still written to stdout, so recover it from the error.
  raw = e.stdout ? e.stdout.toString() : '';
}
if (!raw) {
  console.error('audit-gate: could not read npm audit JSON output');
  process.exit(2);
}

const report = JSON.parse(raw);
const vulns = report.vulnerabilities || {};
const unresolved = [];

for (const [name, v] of Object.entries(vulns)) {
  if (v.severity !== 'high' && v.severity !== 'critical') continue;
  // Only packages carrying a DIRECT advisory (a `via` entry that is an object)
  // are root causes. Entries whose `via` are just parent package-name strings
  // are transitive consequences and are covered when their root is evaluated.
  const direct = (v.via || []).filter((x) => x && typeof x === 'object');
  if (direct.length === 0) continue;
  const notAllowed = direct.filter((a) => !ALLOWLIST.has(a.url));
  if (notAllowed.length > 0) {
    unresolved.push(`${name} [${v.severity}]: ${notAllowed.map((a) => a.url).join(', ')}`);
  }
}

if (unresolved.length > 0) {
  console.error('::error::npm audit found high/critical advisories not in the allowlist:');
  for (const u of unresolved) console.error('  - ' + u);
  console.error(
    '\nIf an advisory is genuinely unfixable from our side, add it to the ' +
      'ALLOWLIST in .github/scripts/audit-gate.mjs with a justification. ' +
      'Otherwise upgrade/override the offending dependency.',
  );
  process.exit(1);
}

const allowed = [...ALLOWLIST.keys()];
console.log(
  `No un-allowlisted high/critical advisories. ${allowed.length} allowlisted: ${allowed.join(', ')}`,
);
process.exit(0);
