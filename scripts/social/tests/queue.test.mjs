/**
 * Unit tests for the queue + posting-log module (scripts/social/lib/queue.mjs).
 * All filesystem work happens in a per-test tmp dir; the real queue/log are
 * never touched. Run: npm run social:test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  loadQueue,
  nextPending,
  pickEvergreen,
  markStatus,
  saveQueue,
  hasEntryFor,
  appendLog,
  queueHealth,
} from '../lib/queue.mjs';

function tmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-queue-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeQueue(dir, queue) {
  const file = path.join(dir, 'queue.json');
  fs.writeFileSync(file, JSON.stringify(queue, null, 2), 'utf8');
  return file;
}

test('loadQueue + nextPending: first pending entry in file order wins', (t) => {
  const dir = tmpDir(t);
  const file = writeQueue(dir, {
    entries: [
      { id: 'a', status: 'posted' },
      { id: 'b', status: 'skipped' },
      { id: 'c', status: 'pending' },
      { id: 'd', status: 'pending' },
    ],
    evergreen: [],
  });
  const queue = loadQueue(file);
  assert.equal(nextPending(queue).id, 'c');
});

test('loadQueue: missing entries/evergreen arrays are defaulted', (t) => {
  const dir = tmpDir(t);
  const file = writeQueue(dir, {});
  const queue = loadQueue(file);
  assert.deepEqual(queue.entries, []);
  assert.deepEqual(queue.evergreen, []);
  assert.equal(nextPending(queue), null);
  assert.equal(pickEvergreen(queue), null);
});

test('markStatus + saveQueue: round-trips through disk', (t) => {
  const dir = tmpDir(t);
  const file = writeQueue(dir, {
    entries: [{ id: 'a', status: 'pending' }],
    evergreen: [],
  });
  const queue = loadQueue(file);
  const entry = markStatus(queue, 'a', 'posted', { mediaId: 'm1', permalink: 'https://ig/p/1' });
  assert.equal(entry.status, 'posted');
  saveQueue(file, queue);

  const reloaded = loadQueue(file);
  const persisted = reloaded.entries[0];
  assert.equal(persisted.status, 'posted');
  assert.equal(persisted.mediaId, 'm1');
  assert.equal(persisted.permalink, 'https://ig/p/1');
  assert.ok(typeof persisted.updatedAt === 'string' && !Number.isNaN(Date.parse(persisted.updatedAt)));
});

test('markStatus: rejects unknown ids and invalid statuses', (t) => {
  const dir = tmpDir(t);
  const queue = loadQueue(writeQueue(dir, { entries: [{ id: 'a', status: 'pending' }], evergreen: [] }));
  assert.throws(() => markStatus(queue, 'nope', 'posted'), /no queue entry/);
  assert.throws(() => markStatus(queue, 'a', 'published'), /invalid status/);
});

test('pickEvergreen: skips entries once usedOn is stamped and saved', (t) => {
  const dir = tmpDir(t);
  const file = writeQueue(dir, {
    entries: [],
    evergreen: [{ id: 'e1' }, { id: 'e2' }],
  });
  const queue = loadQueue(file);

  const first = pickEvergreen(queue);
  assert.equal(first.id, 'e1');
  first.usedOn = '2026-07-13'; // how the caller consumes an evergreen card
  saveQueue(file, queue);

  const reloaded = loadQueue(file);
  assert.equal(reloaded.evergreen[0].usedOn, '2026-07-13');
  assert.equal(pickEvergreen(reloaded).id, 'e2');

  reloaded.evergreen[1].usedOn = '2026-07-14';
  assert.equal(pickEvergreen(reloaded), null, 'exhausted evergreen pool returns null');
});

test('appendLog: creates YYYY-MM.json as an array and appends in order', (t) => {
  const dir = tmpDir(t);
  const logDir = path.join(dir, 'log'); // does not exist yet

  appendLog(logDir, { date: '2026-07-13', id: 'a', status: 'drafted' });
  const file = path.join(logDir, '2026-07.json');
  assert.ok(fs.existsSync(file), 'monthly file is derived from entry.date');

  let log = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(Array.isArray(log));
  assert.equal(log.length, 1);
  assert.deepEqual(log[0], JSON.parse(JSON.stringify({ date: '2026-07-13', id: 'a', status: 'drafted' })));

  appendLog(logDir, { date: '2026-07-14', id: 'b', status: 'posted' });
  log = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(log.length, 2);
  assert.equal(log[1].id, 'b');

  // A different month goes to a different file.
  appendLog(logDir, { date: '2026-08-01', id: 'c', status: 'drafted' });
  assert.ok(fs.existsSync(path.join(logDir, '2026-08.json')));
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).length, 2, 'July file untouched');

  assert.throws(() => appendLog(logDir, { id: 'x' }), /entry\.date/);
});

test('hasEntryFor: true after appendLog for that date only (any status)', (t) => {
  const dir = tmpDir(t);
  const logDir = path.join(dir, 'log');

  assert.equal(hasEntryFor(logDir, '2026-07-13'), false, 'no log dir yet');
  appendLog(logDir, { date: '2026-07-13', status: 'skipped', reason: 'publish-failed' });
  assert.equal(hasEntryFor(logDir, '2026-07-13'), true, 'a skipped record still blocks the day');
  assert.equal(hasEntryFor(logDir, '2026-07-14'), false, 'next day starts fresh');
  assert.equal(hasEntryFor(logDir, '2026-08-13'), false, 'other months unaffected');
});

test('queueHealth: warns strictly below 7 pending', () => {
  const mk = (n) => ({
    entries: [
      ...Array.from({ length: n }, (_, i) => ({ id: `p${i}`, status: 'pending' })),
      { id: 'done', status: 'posted' },
    ],
  });
  assert.deepEqual(queueHealth(mk(7)), { pending: 7, warn: false });
  assert.deepEqual(queueHealth(mk(6)), { pending: 6, warn: true });
  assert.deepEqual(queueHealth(mk(0)), { pending: 0, warn: true });
});

test('atomic write: saveQueue leaves valid JSON and no tmp files behind', (t) => {
  const dir = tmpDir(t);
  const file = writeQueue(dir, { entries: [{ id: 'a', status: 'pending' }], evergreen: [] });
  const queue = loadQueue(file);
  queue.entries[0].topic = 'x'.repeat(50000); // large enough to matter

  saveQueue(file, queue);

  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw); // throws if truncated/corrupt
  assert.equal(parsed.entries[0].topic.length, 50000);
  assert.ok(raw.endsWith('\n'), 'trailing newline for clean diffs');

  const leftovers = fs.readdirSync(dir).filter((f) => f.includes('.tmp'));
  assert.deepEqual(leftovers, [], 'no temp files left after rename');
});
