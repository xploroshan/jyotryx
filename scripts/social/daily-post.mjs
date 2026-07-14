#!/usr/bin/env node
/**
 * daily-post.mjs — the myastro360 Instagram engine orchestrator.
 *
 * One on-brand image post per day. Flow:
 *   1. Idempotency: any log record for today => SKIP (safe to re-run).
 *   2. Pick the first pending queue entry (7-day pillar rotation order).
 *   3. daily-sky/muhurat entries need live panchang; if the API is down we
 *      NEVER fabricate values — fall back to an unused evergreen card.
 *   4. Resolve copy (reviewed queue copy, else optional Claude generation).
 *   5. Render template(s) to 1080x1350 PNG(s) in marketing/social/drafts/<date>/.
 *   6. DRY_RUN=1: stop after rendering. SOCIAL_MODE=draft (default): record
 *      'drafted'. SOCIAL_MODE=publish: upload to R2, publish via Graph API.
 *
 * Env: see scripts/social/README.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadQueue,
  nextPending,
  pickEvergreen,
  markStatus,
  saveQueue,
  hasEntryFor,
  appendLog,
  queueHealth,
} from './lib/queue.mjs';
import { renderTemplate, renderSlides } from './lib/render.mjs';
import { resolveCopy } from './lib/copy.mjs';
import { fetchPanchang, substituteTokens } from './lib/panchang.mjs';
import { makeStorage } from './lib/storage.mjs';
import { makeClient } from './lib/ig-api.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Paths are env-overridable (SOCIAL_*) so tests can run against a tmp copy
// without ever touching the real queue, log or drafts.
const QUEUE_FILE = process.env.SOCIAL_QUEUE_FILE
  || path.join(REPO_ROOT, 'marketing/social/queue/queue.json');
const LOG_DIR = process.env.SOCIAL_LOG_DIR
  || path.join(REPO_ROOT, 'marketing/social/log');
const DRAFTS_ROOT = process.env.SOCIAL_DRAFTS_DIR
  || path.join(REPO_ROOT, 'marketing/social/drafts');
const TEMPLATES_DIR = process.env.SOCIAL_TEMPLATES_DIR
  || path.join(REPO_ROOT, 'marketing/social/templates');

const TZ = 'Asia/Kolkata';

/** ISO date (YYYY-MM-DD) for "today" in IST — the queue's operating timezone. */
function todayInKolkata(now = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
}

/** Human date label like "Monday · 14 July 2026" (en-IN, IST). */
function dateLabelInKolkata(now = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'long' }).format(now);
  const rest = new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  return `${weekday} · ${rest}`;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Plain text with \n\n paragraph breaks -> escaped <p>...</p> blocks for {{{body_html}}}. */
function paragraphsToHtml(text) {
  return String(text ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/** Progress dots for carousel slides: <span class="dot dot--on"> at `active`. */
function progressDotsHtml(total, active) {
  return Array.from({ length: total }, (_, i) =>
    `<span class="dot${i === active ? ' dot--on' : ''}"></span>`,
  ).join('');
}

/**
 * "What is a nakshatra?" -> "nakshatra"; "What is Kaal Sarp Dosha, honestly?"
 * -> "Kaal Sarp Dosha" (for the glossary {{term}} hero slot). Strips the
 * "what is (a|an|the)" lead-in, any trailing comma-clause, and trailing
 * punctuation.
 */
function termFromHeadline(headline) {
  let s = String(headline ?? '').trim();
  const match = s.match(/^what\s+is\s+(?:a\s+|an\s+|the\s+)?(.+)$/i);
  if (match) s = match[1];
  s = s.split(',')[0]; // drop a trailing comma-clause ("..., honestly?")
  return s.replace(/[?.!\s]+$/, '').trim();
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Final caption text: substituted caption plus any hashtags not already
 * present in it (queue captions usually embed the hashtag block already —
 * only append what's missing so tags are never duplicated).
 */
function buildCaption(copy, tokens) {
  const caption = substituteTokens(copy.caption ?? '', tokens).trim();
  // A tag counts as present only on a word boundary: #panchang must NOT be
  // considered present just because the caption contains #panchangfacts (a
  // longer tag sharing it as a prefix). The leading '#' anchors the left edge;
  // the negative lookahead guards the right edge.
  const missing = (copy.hashtags ?? [])
    .map((t) => `#${String(t).replace(/^#/, '')}`)
    .filter((tag) => !new RegExp(`${escapeRegExp(tag)}(?![\\w])`, 'i').test(caption));
  return missing.length > 0 ? `${caption}\n\n${missing.join('\n')}` : caption;
}

async function main() {
  // ---- a. Resolve today's date (IST) and all paths -------------------------
  const now = new Date();
  const today = todayInKolkata(now);
  const dateLabel = dateLabelInKolkata(now);
  const draftsDir = path.join(DRAFTS_ROOT, today);

  // Explicit truthy parse: '1'/'true'/'yes'/'on' => dry run; everything else
  // (incl. the string 'false' and an empty value) => NOT a dry run.
  const dryRun = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.DRY_RUN ?? '').trim().toLowerCase(),
  );
  const mode = process.env.SOCIAL_MODE || 'draft';

  // Publish mode: validate env up front — fail fast, before any queue or
  // rendering work, so nothing is marked/uploaded on a misconfigured runner.
  if (mode === 'publish' && !dryRun) {
    const required = [
      'IG_ACCESS_TOKEN',
      'IG_USER_ID',
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_PUBLIC_URL',
    ];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length > 0 || !makeStorage().isConfigured) {
      console.error(
        `ERROR publish mode misconfigured — missing env: ${missing.join(', ') || '(none)'}; ` +
        'nothing was rendered, marked or uploaded.',
      );
      process.exit(1);
    }
  }

  // ---- b. Idempotency: any log record for today means the day is done ------
  if (hasEntryFor(LOG_DIR, today)) {
    console.log(`SKIP ${today}: log already has a record for today (idempotent re-run).`);
    process.exit(0);
  }

  // ---- c. Pick the first pending entry --------------------------------------
  const queue = loadQueue(QUEUE_FILE);
  let entry = nextPending(queue);
  if (!entry) {
    console.warn('WARN queue empty: no pending entries in queue.json — nothing to post.');
    if (!dryRun) appendLog(LOG_DIR, { date: today, status: 'skipped', reason: 'queue-empty' });
    process.exit(0);
  }

  // ---- d. Live panchang for daily-sky (incl. muhurat framing) entries ------
  // We NEVER fabricate panchang values: if the API gives nothing, the live
  // entry is skipped and an unused evergreen card takes the slot instead.
  let activeEntry = entry;
  let isEvergreen = false;
  let panchang = null;
  if (entry.template === 'daily-sky') {
    panchang = await fetchPanchang({ lat: entry.city?.lat, lng: entry.city?.lng });
    if (!panchang) {
      console.warn(`WARN no live panchang for ${entry.city?.name ?? 'unknown city'}; entry ${entry.id} skipped.`);
      if (!dryRun) markStatus(queue, entry.id, 'skipped', { reason: 'no-live-data' });
      const evergreen = pickEvergreen(queue);
      if (!evergreen) {
        if (!dryRun) {
          saveQueue(QUEUE_FILE, queue);
          appendLog(LOG_DIR, {
            date: today,
            id: entry.id,
            status: 'skipped',
            reason: 'no-live-data',
          });
        }
        console.warn('WARN no evergreen fallback available — skipping the day.');
        process.exit(0);
      }
      activeEntry = evergreen;
      isEvergreen = true;
    }
  }

  // ---- e. Resolve copy (reviewed queue copy, else optional generation) -----
  let copy = null;
  let copyError = null;
  try {
    copy = await resolveCopy(activeEntry);
  } catch (err) {
    copyError = err?.message || String(err);
  }
  if (!copy) {
    console.warn(`WARN no copy for ${activeEntry.id}${copyError ? `: ${copyError}` : ''}`);
    if (!dryRun) {
      if (!isEvergreen) markStatus(queue, activeEntry.id, 'skipped', { reason: 'no-copy' });
      saveQueue(QUEUE_FILE, queue);
      appendLog(LOG_DIR, {
        date: today,
        id: activeEntry.id,
        status: 'skipped',
        reason: 'no-copy',
        ...(copyError ? { error: copyError } : {}),
      });
    }
    process.exit(0);
  }

  // ---- f. Token substitution + per-template data ----------------------------
  const cityName = activeEntry.city?.name ?? '';
  const tokens = {
    city: cityName,
    date_label: dateLabel,
    ...(panchang
      ? {
          tithi: panchang.tithi,
          nakshatra: panchang.nakshatra,
          rahu_kaal: panchang.rahukaal,
          sunrise: panchang.sunrise,
          sunset: panchang.sunset,
        }
      : {}),
  };
  const sub = (text) => substituteTokens(text ?? '', tokens);

  const template = activeEntry.template;
  const templatePath = path.join(TEMPLATES_DIR, `${template}.html`);
  if (!fs.existsSync(templatePath)) {
    console.error(`ERROR unknown template "${template}" (${templatePath} not found).`);
    process.exit(1);
  }

  const isCarousel = Array.isArray(copy.slides) && copy.slides.length >= 2;
  const caption = buildCaption(copy, tokens);

  // ---- g. Render PNG(s) into the drafts dir ---------------------------------
  fs.mkdirSync(draftsDir, { recursive: true });
  let files = [];
  if (isCarousel) {
    // Carousel: one render per slide — first slide is the 'cover' variant,
    // last the 'closer' (CTA), everything between 'content'.
    const total = copy.slides.length;
    const slideData = copy.slides.map((slide, i) => ({
      variant: i === 0 ? 'cover' : i === total - 1 ? 'closer' : 'content',
      eyebrow: sub(copy.eyebrow),
      slide_no: i + 1,
      total,
      headline: sub(slide.headline),
      body_html: paragraphsToHtml(sub(slide.body)),
      progress_dots_html: progressDotsHtml(total, i),
    }));
    files = await renderSlides({
      templatePath,
      slides: slideData,
      outDir: draftsDir,
      baseName: 'slide',
    });
  } else {
    // Single image: map the copy onto the template's placeholder contract.
    let data;
    if (template === 'daily-sky') {
      data = {
        city: cityName,
        date_label: dateLabel,
        tithi: tokens.tithi ?? '',
        nakshatra: tokens.nakshatra ?? '',
        sunrise: tokens.sunrise ?? '',
        sunset: tokens.sunset ?? '',
        rahu_kaal: tokens.rahu_kaal ?? '',
        footnote: sub(copy.factor_line),
      };
    } else if (template === 'glossary') {
      // The glossary card is a crisp term/definition tile: the first body
      // paragraph is the definition; the factor line is the source line.
      data = {
        term: copy.term ?? termFromHeadline(copy.headline),
        term_devanagari: copy.term_devanagari ?? '',
        definition: sub(String(copy.body ?? '').split(/\n{2,}/)[0] ?? ''),
        source_line: sub(copy.factor_line),
      };
    } else if (template === 'quote') {
      data = {
        quote: sub(copy.quote ?? copy.headline),
        attribution: sub(copy.attribution ?? 'MyAstro360'),
      };
    } else {
      // lesson (and any future single-card template with the same contract).
      data = {
        eyebrow: sub(copy.eyebrow),
        headline: sub(copy.headline),
        body_html: paragraphsToHtml(sub(copy.body)),
        factor_line: sub(copy.factor_line),
      };
    }
    const outPath = path.join(draftsDir, 'slide-01.png');
    files = [await renderTemplate({ templatePath, data, outPath })];
  }
  const fileNames = files.map((f) => path.basename(f));

  // caption.txt + meta.json alongside the PNGs for human review.
  fs.writeFileSync(path.join(draftsDir, 'caption.txt'), `${caption}\n`, 'utf8');
  fs.writeFileSync(
    path.join(draftsDir, 'meta.json'),
    `${JSON.stringify(
      {
        id: activeEntry.id,
        pillar: activeEntry.pillar,
        template,
        learnSlug: activeEntry.learnSlug ?? null,
        city: activeEntry.city ?? null,
        files: fileNames,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  // ---- h. DRY_RUN: stop here — queue and log untouched -----------------------
  if (dryRun) {
    console.log(
      `DRY RUN ${today}: rendered ${fileNames.length} file(s) for "${activeEntry.id}" ` +
      `(${activeEntry.pillar}/${template}${isEvergreen ? ', evergreen fallback' : ''}) ` +
      `into ${draftsDir}\n  ${fileNames.join(', ')}\nQueue and log were NOT modified.`,
    );
    process.exit(0);
  }

  const baseLogRecord = {
    date: today,
    id: activeEntry.id,
    pillar: activeEntry.pillar,
    template,
    ...(isEvergreen ? { fallback: true } : {}),
  };

  if (mode !== 'publish') {
    // ---- i. Draft mode (default): record and stop ---------------------------
    // An evergreen fallback is consumed as a draft by stamping usedOn.
    if (isEvergreen) activeEntry.usedOn = today;
    else markStatus(queue, activeEntry.id, 'drafted', { draftDir: draftsDir });
    saveQueue(QUEUE_FILE, queue);
    appendLog(LOG_DIR, { ...baseLogRecord, status: 'drafted', files: fileNames, draftDir: draftsDir });
    console.log(`DRAFTED ${today}: ${activeEntry.id} -> ${draftsDir}`);
    warnQueueHealth(queue);
    process.exit(0);
  }

  // ---- j. Publish mode: upload to R2, then publish via the Graph API --------
  const storage = makeStorage();
  const imageUrls = [];
  for (const file of files) {
    const key = `social/${today}/${path.basename(file)}`;
    const url = await storage.upload({ key, buffer: fs.readFileSync(file), contentType: 'image/png' });
    imageUrls.push(url);
  }

  const client = makeClient({
    accessToken: process.env.IG_ACCESS_TOKEN,
    igUserId: process.env.IG_USER_ID,
  });

  // Write-ahead intent: record a 'publishing' log BEFORE the Graph publish call
  // and persist the queue. hasEntryFor matches ANY status for the date, so if
  // the process dies mid-publish this record blocks a same-day re-pick (which
  // would otherwise auto-repost). NB: usedOn is NOT stamped yet — the evergreen
  // card must only be burned once the post is actually live.
  appendLog(LOG_DIR, {
    ...baseLogRecord,
    status: 'publishing',
    startedAt: new Date().toISOString(),
  });
  saveQueue(QUEUE_FILE, queue);

  try {
    const result = imageUrls.length > 1
      ? await client.publishCarousel({ imageUrls, caption })
      : await client.publishImage({ imageUrl: imageUrls[0], caption });

    // Success: now it is safe to consume the evergreen card / mark the entry.
    if (isEvergreen) activeEntry.usedOn = today;
    else {
      markStatus(queue, activeEntry.id, 'posted', {
        mediaId: result.mediaId,
        permalink: result.permalink,
      });
    }
    saveQueue(QUEUE_FILE, queue);
    appendLog(LOG_DIR, {
      ...baseLogRecord,
      status: 'posted',
      mediaId: result.mediaId,
      permalink: result.permalink,
      topic: activeEntry.topic,
    });
    console.log(`POSTED ${today}: ${activeEntry.id} -> ${result.permalink ?? result.mediaId}`);
    warnQueueHealth(queue);
    process.exit(0);
  } catch (err) {
    // A publish attempt was made (the 'publishing' write-ahead record is
    // already committed). NEVER leave the entry 'pending' — that would let a
    // re-run auto-repost. Distinguish two cases:
    //   - failure at/after media_publish (post MIGHT be live) -> the client
    //     reconciles recoverable successes; an unrecovered one is marked
    //     'skipped' and logged 'needs-review' for a human to check.
    //   - failure strictly before any publish attempt (upload/container-create
    //     or poll failed; nothing is live) -> 'skipped' + 'publish-failed'.
    // Either way the evergreen card is NOT burned (it never went live).
    const mayBeLive = err?.phase === 'media_publish';
    if (!isEvergreen) {
      markStatus(queue, activeEntry.id, 'skipped', {
        reason: mayBeLive ? 'needs-review' : 'publish-failed',
      });
    } else {
      delete activeEntry.usedOn;
    }
    saveQueue(QUEUE_FILE, queue);
    appendLog(LOG_DIR, {
      ...baseLogRecord,
      status: mayBeLive ? 'needs-review' : 'skipped',
      reason: mayBeLive ? 'media_publish-ambiguous' : 'publish-failed',
      error: err?.message || String(err),
    });
    console.error(
      `ERROR publish ${mayBeLive ? 'ambiguous — NEEDS REVIEW (post may be live)' : 'failed'} ` +
      `for ${activeEntry.id}: ${err?.message || err}`,
    );
    process.exit(1);
  }
}

function warnQueueHealth(queue) {
  const { pending, warn } = queueHealth(queue);
  if (warn) {
    console.warn(
      `::warning::Queue runway low: only ${pending} pending entr${pending === 1 ? 'y' : 'ies'} ` +
      'left (< 7). Top up marketing/social/queue/queue.json.',
    );
  }
}

main().catch((err) => {
  console.error(`ERROR daily-post failed: ${err?.stack || err}`);
  process.exit(1);
});
