#!/usr/bin/env node
/**
 * weekly-insights.mjs — weekly maintenance for the myastro360 Instagram engine.
 *
 *   1. Fetch Graph API insights for the last 7 days of 'posted' log records
 *      and merge them into the monthly log files (atomic tmp+rename rewrite).
 *   2. Token hygiene: checkToken(); if it expires within 14 days, attempt
 *      refreshToken() and print a masked notice + a GitHub Actions ::warning::
 *      telling the operator to rotate the IG_ACCESS_TOKEN secret. Tokens are
 *      NEVER written to the repo or printed in full.
 *   3. Queue runway: ::warning:: when fewer than 7 pending entries remain.
 *
 * Exit code: 0 always, unless a log file exists but cannot be read/parsed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQueue, queueHealth } from './lib/queue.mjs';
import { makeClient } from './lib/ig-api.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const QUEUE_FILE = path.join(REPO_ROOT, 'marketing/social/queue/queue.json');
// LOG_DIR is env-overridable (SOCIAL_LOG_DIR, mirroring daily-post.mjs) so tests
// can run against a tmp log without touching the real committed history.
const LOG_DIR = process.env.SOCIAL_LOG_DIR
  || path.join(REPO_ROOT, 'marketing/social/log');

const TZ = 'Asia/Kolkata';
const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_WARN_DAYS = 14;

/** ISO date (YYYY-MM-DD) in IST for a given instant. */
function isoDateInKolkata(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

/** The last 7 IST calendar dates, today included. */
function last7Dates(now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => isoDateInKolkata(new Date(now.getTime() - i * DAY_MS)));
}

/** Atomic JSON write (tmp + rename), mirroring lib/queue.mjs semantics. */
function writeJsonAtomic(file, data) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

/** Show only the edges of a secret, e.g. "EAAB…x9Qz". */
function maskToken(token) {
  if (!token || token.length < 12) return '<redacted>';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

async function main() {
  const now = new Date();
  const dates = new Set(last7Dates(now));

  // Month log files covering the 7-day window (at most two).
  const months = [...new Set([...dates].map((d) => d.slice(0, 7)))];

  const accessToken = process.env.IG_ACCESS_TOKEN;
  const igUserId = process.env.IG_USER_ID;
  const client = accessToken && igUserId ? makeClient({ accessToken, igUserId }) : null;

  // ---- 1. Merge insights into the last 7 days of posted log records --------
  for (const month of months) {
    const file = path.join(LOG_DIR, `${month}.json`);
    if (!fs.existsSync(file)) continue;

    let log;
    try {
      log = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(log)) throw new Error('log is not a JSON array');
    } catch (err) {
      console.error(`ERROR unreadable log file ${file}: ${err?.message || err}`);
      process.exit(1);
    }

    const targets = log.filter(
      (e) => dates.has(e.date) && e.status === 'posted' && e.mediaId,
    );
    if (targets.length === 0) continue;

    if (!client) {
      console.warn(
        'WARN IG_ACCESS_TOKEN / IG_USER_ID not set — skipping insights fetch for ' +
        `${targets.length} posted record(s) in ${month}.`,
      );
      continue;
    }

    let touched = false;
    for (const record of targets) {
      const insights = await client.getInsights(record.mediaId); // never throws
      // Only overwrite committed metrics when the fetch actually returned at
      // least one real metric. A soft-failure ({ warning } only) must never
      // clobber previously stored numbers.
      const hasRealMetric = Object.keys(insights).some((k) => k !== 'warning');
      if (hasRealMetric) {
        record.insights = { ...insights, fetchedAt: new Date().toISOString() };
        touched = true;
      }
      const summary = Object.entries(insights)
        .filter(([k]) => k !== 'warning')
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      console.log(`INSIGHTS ${record.date} ${record.id ?? record.mediaId}: ${summary || '(none)'}${insights.warning ? ` [${insights.warning}]` : ''}`);
    }
    if (touched) writeJsonAtomic(file, log);
  }

  // ---- 2. Token expiry check + refresh notice -------------------------------
  if (client) {
    const status = await client.checkToken(); // never throws
    if (!status.ok) {
      console.warn(`::warning::IG access token check failed: ${status.error ?? 'unknown error'}`);
    } else if (status.expiresAt) {
      const daysLeft = (new Date(status.expiresAt).getTime() - now.getTime()) / DAY_MS;
      if (daysLeft <= EXPIRY_WARN_DAYS) {
        let refreshed = null;
        try {
          refreshed = await client.refreshToken();
        } catch (err) {
          console.warn(`WARN token refresh attempt failed: ${err?.message || err}`);
        }
        if (refreshed?.accessToken) {
          // Never store or fully print tokens — the operator rotates the secret.
          console.log(
            `A refreshed long-lived token (${maskToken(refreshed.accessToken)}, ` +
            `expires in ~${Math.round((refreshed.expiresIn ?? 0) / 86400)} days) was obtained.`,
          );
          console.warn(
            `::warning::IG access token expires ${status.expiresAt} (~${Math.ceil(daysLeft)} days). ` +
            'A refreshed token was obtained but is NOT stored anywhere — re-run the fb_exchange_token ' +
            'flow locally (FB_APP_ID/FB_APP_SECRET) and update the IG_ACCESS_TOKEN repo secret.',
          );
        } else {
          console.warn(
            `::warning::IG access token expires ${status.expiresAt} (~${Math.ceil(daysLeft)} days) ` +
            'and automatic refresh is unavailable (set FB_APP_ID/FB_APP_SECRET). ' +
            'Rotate the IG_ACCESS_TOKEN repo secret before it expires.',
          );
        }
      }
    }
  } else {
    console.warn('WARN IG_ACCESS_TOKEN / IG_USER_ID not set — skipping token check.');
  }

  // ---- 3. Queue runway warning ----------------------------------------------
  try {
    const queue = loadQueue(QUEUE_FILE);
    const { pending, warn } = queueHealth(queue);
    if (warn) {
      console.warn(
        `::warning::Queue runway low: only ${pending} pending entr${pending === 1 ? 'y' : 'ies'} ` +
        'remain (< 7 — less than one weekly rotation). Top up marketing/social/queue/queue.json.',
      );
    } else {
      console.log(`Queue health OK: ${pending} pending entries.`);
    }
  } catch (err) {
    console.warn(`WARN could not read queue for health check: ${err?.message || err}`);
  }

  process.exit(0);
}

main().catch((err) => {
  // Explicitly tolerated degradations (missing IG creds in draft mode, the
  // insights API soft-failing) are handled inside main() and exit 0. An
  // unexpected throw reaching here is a real failure: surface it as a GitHub
  // Actions error and exit 1 so the run shows red (the workflow still commits
  // any partial artifacts via its if:always() step).
  console.error(`::error::weekly-insights failed: ${err?.message || err}`);
  console.error(err?.stack || err);
  process.exit(1);
});
