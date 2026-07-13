/**
 * End-to-end tests for scripts/social/daily-post.mjs: the script is spawned
 * as a real child process in DRY_RUN + draft mode, with all repo paths
 * redirected to a tmp sandbox via the SOCIAL_* env overrides — the real
 * queue, log, drafts and templates are never touched (templates are copied
 * into the sandbox too). Run: npm run social:test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts/social/daily-post.mjs');
const REAL_TEMPLATES = path.join(REPO_ROOT, 'marketing/social/templates');
const E2E_TIMEOUT_MS = 120000;

/** Same IST "today" the script computes (en-CA => YYYY-MM-DD). */
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const GLOSSARY_ENTRY = {
  id: 'test-glossary-1',
  pillar: 'glossary',
  template: 'glossary',
  status: 'pending',
  topic: 'What is a nakshatra?',
  learnSlug: null,
  copy: {
    term_devanagari: 'नक्षत्र',
    headline: 'What is a nakshatra?',
    eyebrow: 'GLOSSARY · नक्षत्र',
    body: 'A nakshatra is one of 27 lunar mansions — equal 13°20′ segments of the sidereal zodiac.\n\nYour janma nakshatra is the segment the Moon occupied at your birth.',
    factor_line: '27 equal segments of 13°20′ each, measured along the Moon’s sidereal path.',
    caption: 'A nakshatra is one of 27 lunar mansions. Link in bio.\n\n#nakshatra #vedicastrology',
    hashtags: ['nakshatra', 'vedicastrology', 'myastro360'],
  },
};

const DAILY_SKY_ENTRY = {
  id: 'test-daily-sky-1',
  pillar: 'daily-sky',
  template: 'daily-sky',
  status: 'pending',
  topic: "Today's sky over Mumbai",
  learnSlug: null,
  city: { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  copy: {
    headline: 'Rahu Kaal · {city} · {rahu_kaal}',
    eyebrow: "TODAY'S SKY · {date_label}",
    body: 'The Moon moves through {nakshatra} today, on {tithi}.',
    factor_line: 'Rahu Kaal is one-eighth of the sunrise-to-sunset arc.',
    caption: "Today's sky over {city} — {tithi}, Moon in {nakshatra}. Link in bio.\n\n#panchang",
    hashtags: ['panchang', 'rahukaal'],
  },
};

const EVERGREEN_ENTRY = {
  id: 'test-evergreen-tithi',
  pillar: 'glossary',
  template: 'glossary',
  topic: 'What is a tithi?',
  learnSlug: null,
  copy: {
    term_devanagari: 'तिथि',
    headline: 'What is a tithi?',
    eyebrow: 'GLOSSARY · तिथि',
    body: 'A tithi is a lunar day: the time the Moon takes to move 12° further from the Sun.',
    factor_line: 'One tithi = 12° of Moon–Sun angular separation.',
    caption: 'A tithi is a lunar day. Link in bio.\n\n#tithi #panchang',
    hashtags: ['tithi', 'panchang'],
  },
};

/** Build a tmp sandbox: queue.json copy, empty log dir, drafts dir, template copies. */
function makeSandbox(t, queue) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'social-e2e-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const queueFile = path.join(root, 'queue.json');
  const logDir = path.join(root, 'log');
  const draftsDir = path.join(root, 'drafts');
  const templatesDir = path.join(root, 'templates');
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(draftsDir, { recursive: true });
  fs.cpSync(REAL_TEMPLATES, templatesDir, { recursive: true });
  fs.writeFileSync(queueFile, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');

  return { root, queueFile, logDir, draftsDir, templatesDir };
}

/** Spawn daily-post.mjs against a sandbox; resolves { code, stdout, stderr }. */
function runDailyPost(sandbox, extraEnv = {}) {
  const env = {
    ...process.env,
    DRY_RUN: '1',
    SOCIAL_MODE: 'draft',
    SOCIAL_QUEUE_FILE: sandbox.queueFile,
    SOCIAL_LOG_DIR: sandbox.logDir,
    SOCIAL_DRAFTS_DIR: sandbox.draftsDir,
    SOCIAL_TEMPLATES_DIR: sandbox.templatesDir,
    ...extraEnv,
  };
  // Determinism: never reach a real panchang API or copy generation.
  delete env.MYASTRO_API_URL;
  delete env.ANTHROPIC_API_KEY;
  for (const [k, v] of Object.entries(extraEnv)) if (v === undefined) delete env[k];

  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT],
      { cwd: REPO_ROOT, env, timeout: E2E_TIMEOUT_MS - 10000 },
      (err, stdout, stderr) => resolve({ code: err ? err.code ?? 1 : 0, stdout, stderr }),
    );
  });
}

function assertPng(file) {
  const bytes = fs.readFileSync(file);
  assert.ok(bytes.length > 20 * 1024, `${path.basename(file)} > 20KB`);
  assert.equal(bytes.readUInt32BE(16), 1080, 'IHDR width');
  assert.equal(bytes.readUInt32BE(20), 1350, 'IHDR height');
}

test('dry run drafts the first pending entry: PNG + caption.txt + meta.json', { timeout: E2E_TIMEOUT_MS }, async (t) => {
  const sandbox = makeSandbox(t, { entries: [GLOSSARY_ENTRY], evergreen: [] });
  const queueBefore = fs.readFileSync(sandbox.queueFile, 'utf8');

  const { code, stdout, stderr } = await runDailyPost(sandbox);
  assert.equal(code, 0, `exit 0 expected\nstdout: ${stdout}\nstderr: ${stderr}`);
  assert.match(stdout, /DRY RUN/);

  const dayDir = path.join(sandbox.draftsDir, TODAY);
  const png = path.join(dayDir, 'slide-01.png');
  assertPng(png);

  const caption = fs.readFileSync(path.join(dayDir, 'caption.txt'), 'utf8');
  assert.ok(caption.includes('A nakshatra is one of 27 lunar mansions. Link in bio.'));
  assert.ok(caption.includes('#myastro360'), 'hashtags missing from the caption body are appended');

  const meta = JSON.parse(fs.readFileSync(path.join(dayDir, 'meta.json'), 'utf8'));
  assert.equal(meta.id, 'test-glossary-1');
  assert.equal(meta.template, 'glossary');
  assert.deepEqual(meta.files, ['slide-01.png']);

  // DRY_RUN promises: queue and log untouched.
  assert.equal(fs.readFileSync(sandbox.queueFile, 'utf8'), queueBefore, 'queue not modified');
  assert.deepEqual(fs.readdirSync(sandbox.logDir), [], 'log not written');
});

test('idempotency: an existing log record for today exits 0 with SKIP and creates nothing', { timeout: E2E_TIMEOUT_MS }, async (t) => {
  const sandbox = makeSandbox(t, { entries: [GLOSSARY_ENTRY], evergreen: [] });
  fs.writeFileSync(
    path.join(sandbox.logDir, `${TODAY.slice(0, 7)}.json`),
    `${JSON.stringify([{ date: TODAY, id: 'earlier-run', status: 'drafted' }], null, 2)}\n`,
    'utf8',
  );

  const { code, stdout } = await runDailyPost(sandbox);
  assert.equal(code, 0);
  assert.match(stdout, /SKIP/);
  assert.deepEqual(fs.readdirSync(sandbox.draftsDir), [], 'no drafts created on a skipped day');
});

test('daily-sky with no MYASTRO_API_URL falls back to evergreen — never fabricates panchang', { timeout: E2E_TIMEOUT_MS }, async (t) => {
  const sandbox = makeSandbox(t, {
    entries: [DAILY_SKY_ENTRY],
    evergreen: [EVERGREEN_ENTRY],
  });

  const { code, stdout, stderr } = await runDailyPost(sandbox);
  assert.equal(code, 0, `exit 0 expected\nstdout: ${stdout}\nstderr: ${stderr}`);
  assert.match(stderr, /no live panchang/i, 'the skip reason is surfaced');
  assert.match(stdout, /evergreen fallback/);

  const dayDir = path.join(sandbox.draftsDir, TODAY);
  const meta = JSON.parse(fs.readFileSync(path.join(dayDir, 'meta.json'), 'utf8'));
  assert.equal(meta.id, 'test-evergreen-tithi', 'the rendered post is the evergreen card');
  assert.equal(meta.template, 'glossary');
  assertPng(path.join(dayDir, 'slide-01.png'));

  const caption = fs.readFileSync(path.join(dayDir, 'caption.txt'), 'utf8');
  assert.ok(caption.includes('A tithi is a lunar day.'));
  assert.ok(!caption.includes('{'), 'no unresolved {tokens} in the shipped caption');
});
