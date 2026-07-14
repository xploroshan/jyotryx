/**
 * Content queue + posting log for the myastro360 Instagram engine.
 *
 * Plain ESM, Node 20+, zero dependencies. The queue file
 * (marketing/social/queue/queue.json) holds hand-written, reviewed copy;
 * this module only reads, selects and marks entries — it never generates
 * content.
 *
 * Shape:
 *   {
 *     entries:   [{ id, pillar, template, status, topic, learnSlug, city?, copy }],
 *     evergreen: [{ id, pillar, template, topic, learnSlug, copy, usedOn? }]
 *   }
 *
 * Log files live one per month at <logDir>/YYYY-MM.json, each a JSON array
 * of { date, ...entry } records. All writes are atomic (tmp + rename) so a
 * crashed run can never leave a truncated queue or log behind.
 */

import fs from 'node:fs';
import path from 'node:path';

const VALID_STATUSES = new Set(['pending', 'drafted', 'posted', 'skipped']);

/**
 * Load and parse a queue file.
 * @param {string} file - path to queue.json.
 * @returns {{ entries: object[], evergreen: object[] }}
 */
export function loadQueue(file) {
  const queue = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(queue.entries)) queue.entries = [];
  if (!Array.isArray(queue.evergreen)) queue.evergreen = [];
  return queue;
}

/**
 * First entry still waiting to be produced.
 * @param {{ entries: object[] }} queue
 * @returns {object|null}
 */
export function nextPending(queue) {
  return queue.entries.find((e) => e.status === 'pending') ?? null;
}

/**
 * First evergreen fallback entry that has not been used yet.
 *
 * Does not mutate: after posting an evergreen card, the caller marks it by
 * setting `entry.usedOn = 'YYYY-MM-DD'` and calling saveQueue(), so the next
 * pick skips it.
 *
 * @param {{ evergreen: object[] }} queue
 * @returns {object|null}
 */
export function pickEvergreen(queue) {
  return queue.evergreen.find((e) => !e.usedOn) ?? null;
}

/**
 * Set an entry's status (and any extra fields), stamping updatedAt.
 * Mutates the queue in place; call saveQueue() to persist.
 *
 * @param {{ entries: object[] }} queue
 * @param {string} id - entry id.
 * @param {'pending'|'drafted'|'posted'|'skipped'} status
 * @param {object} [extra] - extra fields to merge onto the entry
 *   (e.g. { mediaId, permalink } after publishing).
 * @returns {object} the mutated entry.
 */
export function markStatus(queue, id, status, extra = {}) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(
      `markStatus: invalid status "${status}" (expected one of: ${[...VALID_STATUSES].join(', ')})`,
    );
  }
  const entry = queue.entries.find((e) => e.id === id);
  if (!entry) throw new Error(`markStatus: no queue entry with id "${id}"`);
  Object.assign(entry, { status }, extra, { updatedAt: new Date().toISOString() });
  return entry;
}

/**
 * Persist the queue atomically (write to a tmp file, then rename) with
 * 2-space indentation so diffs stay reviewable.
 *
 * @param {string} file - path to queue.json.
 * @param {object} queue
 */
export function saveQueue(file, queue) {
  writeJsonAtomic(file, queue);
}

/**
 * Idempotency check: has the engine already produced ANY log record for a
 * date? Reads <logDir>/YYYY-MM.json (derived from the date) and looks for any
 * record with entry.date === isoDate — regardless of status. A same-day
 * 'skipped' record (queue empty, no live data, publish failure) also counts
 * as done, so a retry can never double-post the day; the next calendar day
 * starts fresh.
 *
 * @param {string} logDir - directory holding monthly log files.
 * @param {string} isoDate - 'YYYY-MM-DD'.
 * @returns {boolean}
 */
export function hasEntryFor(logDir, isoDate) {
  const file = logFileFor(logDir, isoDate);
  if (!fs.existsSync(file)) return false;
  const log = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(log)) return false;
  return log.some((e) => e.date === isoDate);
}

/**
 * Append a record to the monthly log (created if absent), atomically.
 * The month file is derived from entry.date.
 *
 * @param {string} logDir - directory holding monthly log files.
 * @param {object} entry - must include date: 'YYYY-MM-DD'.
 * @returns {object[]} the full log array after appending.
 */
export function appendLog(logDir, entry) {
  if (!entry || typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(entry.date)) {
    throw new Error("appendLog: entry.date must be an ISO date string ('YYYY-MM-DD')");
  }
  const file = logFileFor(logDir, entry.date);
  let log = [];
  if (fs.existsSync(file)) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    // A non-array log file is corruption: throw (like a parse failure) rather
    // than silently discarding committed history by replacing it.
    if (!Array.isArray(parsed)) {
      throw new Error(`appendLog: existing log ${file} is not a JSON array`);
    }
    log = parsed;
  }
  const { date, ...rest } = entry;
  log.push({ date, ...rest });
  writeJsonAtomic(file, log);
  return log;
}

/**
 * Runway check: how many pending entries remain, and should the operator be
 * warned to top the queue up? (< 7 pending = less than one weekly rotation.)
 *
 * @param {{ entries: object[] }} queue
 * @returns {{ pending: number, warn: boolean }}
 */
export function queueHealth(queue) {
  const pending = queue.entries.filter((e) => e.status === 'pending').length;
  return { pending, warn: pending < 7 };
}

/** @param {string} logDir @param {string} isoDate */
function logFileFor(logDir, isoDate) {
  return path.join(logDir, `${isoDate.slice(0, 7)}.json`);
}

/** Atomic JSON write: tmp file in the same directory, then rename. */
function writeJsonAtomic(file, data) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}
