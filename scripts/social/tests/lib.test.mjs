/**
 * No-network unit tests for the Instagram engine's pure helpers.
 * Run: npm run social:test  (node --test scripts/social/tests/)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { fillTemplate } from '../lib/render.mjs';
import { substituteTokens, fetchPanchang } from '../lib/panchang.mjs';
import { resolveCopy } from '../lib/copy.mjs';
import {
  loadQueue,
  nextPending,
  pickEvergreen,
  markStatus,
  hasEntryFor,
  appendLog,
  queueHealth,
} from '../lib/queue.mjs';

test('fillTemplate escapes {{}} and passes {{{}}} raw, blanks missing keys', () => {
  const out = fillTemplate('<h1>{{a}}</h1><div>{{{b}}}</div><p>{{missing}}</p>', {
    a: '<x>&',
    b: '<p>ok</p>',
  });
  assert.equal(out, '<h1>&lt;x&gt;&amp;</h1><div><p>ok</p></div><p></p>');
});

test('substituteTokens replaces known tokens and leaves unknown ones visible', () => {
  const out = substituteTokens('Rahu Kaal in {city}: {rahu_kaal} ({unknown})', {
    city: 'Mumbai',
    rahu_kaal: '09:12–10:47',
  });
  assert.equal(out, 'Rahu Kaal in Mumbai: 09:12–10:47 ({unknown})');
});

test('fetchPanchang returns null when apiBase is unset', async () => {
  assert.equal(await fetchPanchang({ lat: 1, lng: 2, apiBase: undefined }), null);
});

test('fetchPanchang returns null on network failure (never throws)', async () => {
  const result = await fetchPanchang({
    lat: 19.076,
    lng: 72.8777,
    apiBase: 'http://127.0.0.1:1/api',
  });
  assert.equal(result, null);
});

test('resolveCopy returns reviewed queue copy verbatim', async () => {
  const copy = { headline: 'H', caption: 'C' };
  assert.equal(await resolveCopy({ id: 'x', copy }), copy);
});

test('resolveCopy returns null without copy when generation is disabled', async () => {
  assert.equal(await resolveCopy({ id: 'x', topic: 't' }, { generate: false }), null);
});

test('queue: pick, mark, log idempotency (any same-day record counts)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-test-'));
  try {
    const queueFile = path.join(dir, 'queue.json');
    fs.writeFileSync(
      queueFile,
      JSON.stringify({
        entries: [
          { id: 'a', status: 'posted' },
          { id: 'b', status: 'pending' },
        ],
        evergreen: [{ id: 'e1' }, { id: 'e2', usedOn: '2026-01-01' }],
      }),
    );
    const queue = loadQueue(queueFile);
    assert.equal(nextPending(queue).id, 'b');
    assert.equal(pickEvergreen(queue).id, 'e1');
    markStatus(queue, 'b', 'drafted', { draftDir: '/tmp/x' });
    assert.equal(nextPending(queue), null);
    assert.equal(queueHealth(queue).warn, true);

    const logDir = path.join(dir, 'log');
    assert.equal(hasEntryFor(logDir, '2026-07-13'), false);
    appendLog(logDir, { date: '2026-07-13', status: 'skipped', reason: 'publish-failed' });
    assert.equal(hasEntryFor(logDir, '2026-07-13'), true, 'a skipped record blocks the day');
    assert.equal(hasEntryFor(logDir, '2026-07-14'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
