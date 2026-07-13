# myastro360 Instagram Engine — Operator Runbook

Automation for one on-brand, knowledge-dense image post per day on
`@myastro360`. Design doc and rationale:
[`marketing/social/instagram-daily-engine.md`](../../marketing/social/instagram-daily-engine.md).
Brand-voice vetoes from `marketing/social/social-playbook.md` apply to every
post: no fear-selling, no fabricated proof, every claim traces to a chart
factor, warm and honest, "interpretation, not fact".

## Layout

| Path | What |
|---|---|
| `scripts/social/lib/queue.mjs` | Queue + monthly log layer (load/pick/mark/save, idempotency check) |
| `scripts/social/lib/render.mjs` | HTML template → 1080×1350 PNG (headless Chromium) |
| `scripts/social/lib/storage.mjs` | R2 upload → public image URL for the Graph API |
| `scripts/social/lib/ig-api.mjs` | Instagram Graph API (container create + publish) |
| `marketing/social/templates/` | HTML templates, one per pillar — the agent fills placeholders, never restyles |
| `marketing/social/queue/queue.json` | Hand-written, reviewed content queue (+ evergreen fallbacks) |
| `marketing/social/drafts/` | Draft-mode output, one folder per day |
| `marketing/social/log/` | Posting log, one JSON file per month |

## Environment contract

| Variable | Required | Purpose |
|---|---|---|
| `IG_ACCESS_TOKEN` | publish mode | Long-lived Instagram Graph API token (60-day expiry; weekly job refreshes and warns at <14 days) |
| `IG_USER_ID` | publish mode | Instagram professional-account user ID |
| `GRAPH_API_BASE` | no | Graph API base URL override (defaults to the current `graph.facebook.com` version) |
| `FB_APP_ID` | no | Meta app ID — only needed for the token-refresh job |
| `FB_APP_SECRET` | no | Meta app secret — only needed for the token-refresh job |
| `R2_ACCOUNT_ID` | publish mode | Cloudflare R2 account for public image hosting |
| `R2_ACCESS_KEY_ID` | publish mode | R2 credentials |
| `R2_SECRET_ACCESS_KEY` | publish mode | R2 credentials |
| `R2_BUCKET_NAME` | no | R2 bucket (default `myastro360-uploads`) |
| `R2_PUBLIC_URL` | publish mode | Public base URL of the bucket — Graph API fetches `image_url` server-side, so it must be public |
| `MYASTRO_API_URL` | yes | myastro360 API base for live panchang data (tithi, nakshatra, rahu kaal, sunrise/sunset per city) |
| `ANTHROPIC_API_KEY` | no | Enables the Claude QA/polish pass on captions; without it, queue copy is used verbatim |
| `CLAUDE_MODEL` | no | Model override for the QA pass |
| `SOCIAL_MODE` | no | `draft` (default) or `publish` |
| `DRY_RUN` | no | If set, compute and print everything, write nothing, call no external APIs |

## Running locally

```sh
npm run social:daily    # produce (and in publish mode, post) today's content
npm run social:weekly   # queue-health report + access-token refresh/expiry check
npm run social:test     # render every template with fixture data into drafts/, no network
```

## The daily pipeline

1. **Kill-switch check** — exit immediately if the engine is disabled (see
   Operations below).
2. **Idempotency check** — `hasEntryFor(logDir, today)`: if the month log
   already has a `posted` or `drafted` record for today's date, exit 0. Safe
   to re-run on retries, re-delivered cron events, or manual + scheduled
   overlap; you can never double-post a day.
3. **Pick the entry** — `nextPending(queue)` takes the first `pending` entry
   (the queue is ordered as the 7-day pillar rotation).
4. **Fetch live data** — for `daily-sky` / `muhurat` entries, call
   `MYASTRO_API_URL` for the entry's city (lat/lng in the entry) and
   substitute the `{tithi} {nakshatra} {rahu_kaal} {sunrise} {sunset} {city}
   {date_label}` tokens in the copy.
5. **Evergreen fallback** — if that API call fails, the engine **never
   fabricates panchang numbers** (fabricated determinism would destroy the
   positioning). Instead it posts the next unused evergreen glossary card
   (`pickEvergreen`), marks it with `usedOn`, and leaves the live entry
   `pending` for the next run.
6. **Render** — fill the entry's HTML template
   (`marketing/social/templates/<template>.html`) and screenshot to
   1080×1350 PNG(s); carousels render one PNG per slide.
7. **Deliver** —
   - `SOCIAL_MODE=draft`: write everything to
     `marketing/social/drafts/YYYY-MM-DD/` for human review (layout below).
   - `SOCIAL_MODE=publish`: upload PNGs to R2, create the Graph API media
     container(s) (carousel children + parent when needed), then publish.
8. **Record** — `markStatus(queue, id, 'drafted'|'posted', extra)`,
   `appendLog(logDir, { date, id, pillar, template, status, ... })`,
   `saveQueue(...)` — all writes atomic.
9. **Health warning** — `queueHealth(queue)`: if fewer than 7 pending entries
   remain (less than one rotation of runway), emit a warning so the operator
   tops the queue up.

## Idempotency guarantee

The month log is the source of truth: one `posted`/`drafted` record per date,
checked before any work happens. Queue and log writes go through tmp-file +
rename, so a crash mid-run can never leave a truncated file or a half-recorded
day.

## Draft-mode output layout

```
marketing/social/drafts/YYYY-MM-DD/
  slide-01.png        # single-image posts have exactly one
  slide-02.png ...    # carousel slides in order
  caption.txt         # final caption incl. hashtag block, tokens substituted
  meta.json           # { date, id, pillar, template, mode, city?, tokens?, hashtags }
```

Review, then either publish manually or flip `SOCIAL_MODE=publish` once trust
is established.

## Log format

`marketing/social/log/YYYY-MM.json` — a JSON array, one record per produced
day:

```json
[
  {
    "date": "2026-07-13",
    "id": "daily-sky-mumbai-1",
    "pillar": "daily-sky",
    "template": "daily-sky",
    "status": "posted",
    "mediaId": "1789...",
    "permalink": "https://www.instagram.com/p/..."
  }
]
```

Draft-mode records carry `status: "drafted"` and a `draftDir` instead of
`mediaId`/`permalink`. Evergreen-fallback records add `fallback: true` and the
evergreen id.

## Known limitation: alt text

The Instagram content-publishing API **does not accept custom alt text** on
published media — there is no supported field on the media container, so posts
published by this engine get Instagram's auto-generated alt text only. (The
design doc's "always set alt text via the API" is aspirational; it is not
currently possible.) If accessibility of a specific post matters, edit the alt
text manually in the Instagram app after publishing. Revisit if Meta ships the
field.

## Operations: GitHub Actions + Claude Routine

Two cooperating schedulers, one idempotent pipeline:

- **GitHub Actions** — a scheduled workflow runs `npm run social:daily` every
  morning (IST) with secrets from the repo environment, plus a weekly workflow
  for `social:weekly` (queue health + token refresh). Cron drift or duplicate
  deliveries are harmless thanks to the idempotency check.
- **Claude Routine** — a scheduled Claude session reviews queue health, writes
  new queue entries when runway drops below 7 (human-reviewed via PR), and
  investigates failed runs. The Routine writes content into the queue; only
  the Actions pipeline publishes.

### Kill switches

Either of these stops posting immediately; both are safe to use at any time:

1. **Repo variable `SOCIAL_ENGINE_ENABLED`** — set to `false` (Settings →
   Actions → Variables). The daily workflow checks it first and exits before
   doing any work. Flip back to `true` to resume.
2. **Disable the Claude Routine** — pause or delete the Routine so no new
   content or investigation runs happen.

Belt-and-braces: revoking `IG_ACCESS_TOKEN` (or removing the repo secret) also
makes publishing impossible while leaving draft mode usable.
