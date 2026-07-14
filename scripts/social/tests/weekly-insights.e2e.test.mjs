/**
 * End-to-end tests for scripts/social/weekly-insights.mjs. The script is
 * spawned as a real child process against a tmp SOCIAL_LOG_DIR and a mock
 * Graph API (node:http on an ephemeral port, injected via GRAPH_API_BASE).
 * No real network, no touching the committed log. Run: npm run social:test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts/social/weekly-insights.mjs');
const E2E_TIMEOUT_MS = 60000;

const IG_USER = '17841400000000000';
const TOKEN = 'TEST_TOKEN';

/** Same IST "today" the script computes (en-CA => YYYY-MM-DD). */
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const MONTH = TODAY.slice(0, 7);

/**
 * Start a mock Graph server. `route(req)` receives { method, path, query, count }
 * and returns { status?, body? }.
 */
async function startMock(t, route) {
  const requests = [];
  const perPathCounts = new Map();
  const server = createServer(async (req, res) => {
    for await (const _chunk of req) { /* drain */ }
    const url = new URL(req.url, 'http://mock');
    const key = `${req.method} ${url.pathname}`;
    const count = (perPathCounts.get(key) ?? 0) + 1;
    perPathCounts.set(key, count);
    const record = {
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      count,
    };
    requests.push(record);
    const out = route(record) ?? { status: 404, body: { error: { message: `no route for ${key}` } } };
    res.statusCode = out.status ?? 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(out.body ?? {}));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { apiBase: `http://127.0.0.1:${server.address().port}`, requests };
}

/** A tmp SOCIAL_LOG_DIR sandbox. */
function makeSandbox(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-e2e-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const logDir = path.join(root, 'log');
  fs.mkdirSync(logDir, { recursive: true });
  return { root, logDir };
}

function writeLog(logDir, month, records) {
  fs.writeFileSync(path.join(logDir, `${month}.json`), `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

function readLog(logDir, month) {
  return JSON.parse(fs.readFileSync(path.join(logDir, `${month}.json`), 'utf8'));
}

/** Spawn weekly-insights.mjs; resolves { code, stdout, stderr }. */
function runWeekly(sandbox, extraEnv = {}) {
  const env = {
    ...process.env,
    SOCIAL_LOG_DIR: sandbox.logDir,
    // Talk to the mock over loopback, never through the agent proxy.
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost',
    ...extraEnv,
  };
  delete env.HTTPS_PROXY;
  delete env.HTTP_PROXY;
  delete env.https_proxy;
  delete env.http_proxy;
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

test('merges insights into matching posted records; atomic rewrite preserves others', { timeout: E2E_TIMEOUT_MS }, async (t) => {
  const sandbox = makeSandbox(t);
  const other1 = { date: TODAY, id: 'drafted-one', status: 'drafted' };
  const other2 = { date: '2000-01-01', id: 'ancient', status: 'posted', mediaId: 'old-media' };
  writeLog(sandbox.logDir, MONTH, [
    other1,
    { date: TODAY, id: 'live-post', status: 'posted', mediaId: 'm1' },
    other2,
  ]);

  const { apiBase } = await startMock(t, (req) => {
    if (req.path === '/m1/insights') {
      return { body: { data: [
        { name: 'reach', values: [{ value: 500 }] },
        { name: 'likes', values: [{ value: 40 }] },
      ] } };
    }
    if (req.path === '/me') return { body: { id: 'me-1' } };
    return undefined;
  });

  const { code, stdout, stderr } = await runWeekly(sandbox, {
    IG_ACCESS_TOKEN: TOKEN,
    IG_USER_ID: IG_USER,
    GRAPH_API_BASE: apiBase,
    FB_APP_ID: undefined,
    FB_APP_SECRET: undefined,
  });
  assert.equal(code, 0, `exit 0 expected\nstdout: ${stdout}\nstderr: ${stderr}`);

  const log = readLog(sandbox.logDir, MONTH);
  const target = log.find((e) => e.id === 'live-post');
  assert.equal(target.insights.reach, 500);
  assert.equal(target.insights.likes, 40);
  assert.ok(target.insights.fetchedAt, 'a fetchedAt timestamp is stamped');

  // Out-of-window and non-posted records are untouched (atomic rewrite).
  assert.deepEqual(log.find((e) => e.id === 'drafted-one'), other1);
  assert.deepEqual(log.find((e) => e.id === 'ancient'), other2);
});

test('C18: a soft-failure (warning-only) never clobbers existing real metrics', { timeout: E2E_TIMEOUT_MS }, async (t) => {
  const sandbox = makeSandbox(t);
  const existing = { reach: 999, likes: 5, fetchedAt: '2020-01-01T00:00:00.000Z' };
  writeLog(sandbox.logDir, MONTH, [
    { date: TODAY, id: 'live-post', status: 'posted', mediaId: 'm1', insights: { ...existing } },
  ]);

  // Insights AND the basic-count fallback both fail -> getInsights returns
  // { warning } only, so the committed numbers must survive.
  const { apiBase } = await startMock(t, (req) => {
    if (req.path === '/m1/insights') return { status: 400, body: { error: { message: 'temporary', code: 1 } } };
    if (req.path === '/m1') return { status: 400, body: { error: { message: 'temporary', code: 1 } } };
    if (req.path === '/me') return { body: { id: 'me-1' } };
    return undefined;
  });

  const { code, stdout, stderr } = await runWeekly(sandbox, {
    IG_ACCESS_TOKEN: TOKEN,
    IG_USER_ID: IG_USER,
    GRAPH_API_BASE: apiBase,
    FB_APP_ID: undefined,
    FB_APP_SECRET: undefined,
  });
  assert.equal(code, 0, `exit 0 expected\nstdout: ${stdout}\nstderr: ${stderr}`);

  const log = readLog(sandbox.logDir, MONTH);
  assert.deepEqual(log.find((e) => e.id === 'live-post').insights, existing, 'prior metrics preserved');
});

test('C29: an unreadable log file is a hard failure (exit 1)', { timeout: E2E_TIMEOUT_MS }, async (t) => {
  const sandbox = makeSandbox(t);
  // Corrupt (non-JSON) month file in the 7-day window.
  fs.writeFileSync(path.join(sandbox.logDir, `${MONTH}.json`), '{ this is : not json', 'utf8');

  // No IG creds needed: the merge loop reads the log before any Graph call.
  const { code, stderr } = await runWeekly(sandbox, {
    IG_ACCESS_TOKEN: undefined,
    IG_USER_ID: undefined,
    GRAPH_API_BASE: undefined,
  });
  assert.equal(code, 1, 'a corrupt/unreadable log surfaces as exit 1, never a silent exit 0');
  assert.match(stderr, /unreadable log file/i);
});

test('expiry window emits the rotate ::warning::', { timeout: E2E_TIMEOUT_MS }, async (t) => {
  const sandbox = makeSandbox(t); // empty log dir -> merge is a no-op

  const soonSec = Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60; // ~5 days out
  const { apiBase } = await startMock(t, (req) => {
    if (req.path === '/debug_token') {
      return { body: { data: { is_valid: true, expires_at: soonSec } } };
    }
    // Refresh yields no token -> automatic refresh "unavailable" branch.
    if (req.path === '/oauth/access_token') return { body: {} };
    return undefined;
  });

  const { code, stdout, stderr } = await runWeekly(sandbox, {
    IG_ACCESS_TOKEN: TOKEN,
    IG_USER_ID: IG_USER,
    GRAPH_API_BASE: apiBase,
    FB_APP_ID: 'app123',
    FB_APP_SECRET: 'secretsecret',
  });
  assert.equal(code, 0, `exit 0 expected\nstdout: ${stdout}\nstderr: ${stderr}`);
  assert.match(stderr, /::warning::/, 'a GitHub Actions warning is emitted');
  assert.match(stderr, /Rotate the IG_ACCESS_TOKEN repo secret/, 'operator is told to rotate the token');
});
