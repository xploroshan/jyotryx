# myastro360

AI-powered, multi-tradition astrology platform. Vedic + Western + Chinese + Hellenistic + Horary + Medical astrology, palmistry, tarot, numerology, vastu, daily briefings, and an admin operations console — all wired together with multi-provider LLM failover, credit-metered billing, and GDPR-grade audit logging.

Production: [www.myastro360.com](https://www.myastro360.com) · API: `api.myastro360.com` · Repo: `xploroshan/myastro360`

- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [Features](#features)
- [Knowledge base, AI, and how each feature uses them](#knowledge-base-ai-and-how-each-feature-uses-them)
- [Local development](#local-development)
- [Deployment](#deployment)
- [API surface](#api-surface)
- [Database](#database)
- [Background jobs](#background-jobs)
- [Observability](#observability)
- [Admin dashboard](#admin-dashboard)
- [Pricing & credits](#pricing--credits)
- [Project conventions](#project-conventions)

## Repository layout

```
myastro360/
├── apps/
│   ├── api/          # NestJS backend (port 4000)
│   └── web/          # Next.js 15 web app (port 3000, App Router)
├── k8s/base/         # Kubernetes manifests (api/web/worker/HPA/ingress)
├── scripts/          # Operational shell scripts
├── tests/            # Cross-app test helpers
├── docs/             # DEPLOYMENT.md and other long-form docs
├── docker-compose.yml
├── turbo.json
└── vercel.json
```

The repo is intentionally **apps-only** — no mobile app, no `packages/shared`. Web ↔ API contracts live in TypeScript types kept in step manually (or asserted by `apps/web/src/__tests__/admin-url-contract.test.ts` for the admin surface).

## Tech stack

| Layer | Technology |
|---|---|
| Web | Next.js 15 (App Router, RSC), TypeScript, Tailwind CSS v4, Zustand |
| API | NestJS 11, TypeScript, Node 20 |
| ORM | Prisma 7 (`@prisma/adapter-pg`) |
| Database | PostgreSQL 16 + pgvector (via Supabase in prod) |
| Cache / queue | Redis 7 (Upstash in prod) |
| Background jobs | BullMQ |
| LLM providers | OpenAI · Google Gemini · Anthropic (failover chain) |
| Vector search | pgvector (no external Pinecone) |
| Vision (palmistry) | OpenAI Vision API (no on-prem CV libs) |
| Object storage | Cloudflare R2 |
| Astronomy engine | Swiss Ephemeris (`swisseph` C++ binding) |
| Payments | Razorpay (UPI / cards / subscriptions) |
| Auth | Email+password, SMS OTP, Google, Apple, Firebase |
| Observability | Prometheus (`/api/metrics`), OpenTelemetry, Sentry |
| Web hosting | Vercel |
| API hosting | Railway (or self-hosted K8s using `k8s/base/`) |

## Features

### Astrology — multi-tradition

- **Vedic**: kundli (rasi/navamsa/bhava), divisional charts D9–D60, KP Paddhati, Ashtakoota guna milan matching, doshas (Manglik, Kaal Sarp, Pitra, Nadi), Sade Sati, dashas (Vimshottari, Ashtottari, Yogini), panchang (tithi/nakshatra/yoga/karana/vara), muhurat finder.
- **Western**: tropical natal, synastry, transits, aspects, progressions.
- **Chinese**: BaZi (Four Pillars), 12-animal × 5-element zodiac, Feng Shui flying stars.
- **Hellenistic**: sect determination, planetary joys, annual profections, zodiacal releasing.
- **Horary & medical**: horary judgment, decumbiture (illness chart), zodiac-body correspondences.
- **Daily briefing**: personalized "My Day" + planetary hours + offline pack.

### Other features

- **AI chat** with category-specialized agents (career / relationships / finance / health / spiritual). Sync and SSE-streamed responses, OpenAI moderation on every message.
- **Palmistry**: photo upload → BullMQ vision queue → AI palm reading.
- **Tarot**: single / three-card / Celtic-cross spreads with LLM interpretation.
- **Numerology**: personal name, business/brand, personal year theme.
- **Vastu**: directional analysis with deity / element / planet mapping.
- **PDF reports**: Life, Career, Marriage, Wealth, Palm, Annual — queued generation, R2 delivery.
- **Knowledge base**: 18 structured i18n tables (planets, nakshatras, doshas, etc.) plus pgvector embeddings for grounded LLM responses.
- **i18n**: en, hi, ta, bn, te, kn, ml, gu, or, as.

### Admin & operations

- Multi-tab admin dashboard (Users, Activity, Analytics, LLM, Content, Cost, Funnel, Ops, Safety, GDPR, Settings).
- Per-feature credit-spend breakdowns, MRR/ARR, weekly cohort retention.
- LLM kill-switch per provider, runtime model + cost overrides without redeploy, capacity forecasting.
- Activity audit log with one-click undo on credit grants and role changes.
- Admin "Grant credits" with typed `ADMIN_GRANT` transactions.
- Auto-refund: every credit-spending feature refunds on downstream failure.
- Content moderation queue with admin review.
- GDPR export + delete with 30-day SLA tracking.

## Knowledge base, AI, and how each feature uses them

Most features compute their answers **deterministically** from Swiss Ephemeris plus the structured Knowledge Base. Only a handful of features actually call an LLM. This is intentional: it keeps astrology mathematically accurate, dramatically cheaper, faster, and lets every chart be reproduced byte-for-byte for the same inputs.

### Per-feature breakdown

| Feature | Computation engine | KB tables consumed | LLM? |
|---|---|---|---|
| Kundli (Vedic birth chart) | Swiss Ephemeris | `kb_planets`, `kb_nakshatras`, `kb_zodiac_signs`, `kb_yogas` | No |
| Kundli matching (Ashtakoota) | Swiss Ephemeris | `kb_doshas`, `kb_briefing_phrases` (dosha templates) | No |
| Divisional charts (D9–D60) | Swiss Ephemeris | `kb_zodiac_signs`, `kb_planets` | No |
| KP Paddhati | Swiss Ephemeris | `kb_planets`, `kb_nakshatras` | No |
| Western natal / synastry / transits | Swiss Ephemeris | `kb_zodiac_signs`, `kb_briefing_phrases` | No |
| Hellenistic (profections, ZR) | Swiss Ephemeris | `kb_hellenistic_planets`, `kb_briefing_phrases` | No |
| Horary judgment | Swiss Ephemeris | `kb_zodiac_signs`, `kb_briefing_phrases` (horary templates) | No |
| Decumbiture (medical) | Swiss Ephemeris | `kb_zodiac_signs` (body parts), `kb_briefing_phrases` | No |
| BaZi (Four Pillars) | Pure calc | `kb_chinese_animals` | No |
| Chinese flying stars | Pure calc | `kb_flying_stars` | No |
| Panchang | Swiss Ephemeris | `kb_tithis`, `kb_nakshatras`, `kb_yogas`, `kb_varas`, `kb_karanas`, `kb_pakshas` | No |
| Sade Sati | Swiss Ephemeris | `kb_briefing_phrases` (sade-sati templates) | No |
| Dosha detection | Swiss Ephemeris | `kb_doshas` | No |
| Daily briefing / My Day | Swiss Ephemeris | `kb_planets`, `kb_briefing_phrases`, `kb_profession_insights` | Optional (personalization) |
| Numerology (name / brand / personal year) | Pure calc | `kb_number_meanings`, `kb_business_sectors`, `kb_personal_year_themes` | No |
| Public horoscope (`/horoscope/:sign`) | Pure calc | `kb_zodiac_signs`, `kb_briefing_phrases` | No |
| Muhurat finder | Swiss Ephemeris | `kb_briefing_phrases` (muhurat templates) | No |
| Medical body-zodiac map | Static lookup | `kb_zodiac_signs` | No |
| **Chat** | LLM | `knowledge_documents` (pgvector RAG) | **Yes** |
| **Tarot draw** | Random shuffle | `knowledge_documents` (vector context) | **Yes** (interpretation) |
| **Vastu analysis** | Deterministic scoring | `knowledge_documents` | **Yes** (narrative) |
| **Palmistry** | — | `knowledge_documents` (palmistry KB) | **Yes** (OpenAI Vision) |
| **PDF reports** | Mixed | `kb_report_sections` (fallback) + `knowledge_documents` | **Yes** (long-form generation) |

### Knowledge base — what's in it

The KB has two complementary halves.

**Structured tables (18 of them, all i18n).** Each row carries an `i18n` JSON blob keyed by locale (en, hi, ta, bn, te, kn, ml, gu, or, as):

- `kb_planets` — 9 grahas × { name, color, remedy, mantra, doList[], avoidList[] }
- `kb_nakshatras` — 27 lunar mansions × name + quality
- `kb_tithis` — 16 tithis (15 lunar days + Amavasya)
- `kb_yogas` — 27 yogas (Sun + Moon longitude combinations)
- `kb_varas` — 7 weekday lords
- `kb_karanas` — 11-half-lunar-day cycle names
- `kb_pakshas` — Shukla / Krishna lunar phases
- `kb_zodiac_signs` — 12 signs × element / modality / body parts / guidance, multi-tradition
- `kb_chinese_animals` — 12 animals × traits
- `kb_flying_stars` — 9 Feng Shui palace meanings
- `kb_hellenistic_planets` — 7 classical planets × sect, joy house, sect role
- `kb_doshas` — Manglik / Kaal Sarp / Pitra / Nadi with remedy lists
- `kb_number_meanings` — 1–9 plus master numbers 11/22/33
- `kb_business_sectors` — numerology-aligned suitable / avoid industries
- `kb_personal_year_themes` — 1–9 yearly themes (career, finance, relationships, health)
- `kb_profession_insights` — 10 professions × 7 planets = 70 transit guidance rows
- `kb_briefing_phrases` — templated phrases for greetings, transits, dosha narratives, sade-sati, horary, BaZi, Western/Hellenistic, decumbiture
- `kb_report_sections` — 6 report types × 6 sections = 36 fallback templates

**Vector index (`knowledge_documents`).** A flat document store with:

- `text` — the chunk
- `category` — `kundli` / `horoscope` / `dosha` / `remedy` / `matching` / `panchang` / `numerology` / `palmistry` / `tarot` / `vastu` / `general`
- `embedding` — 1536-dim `vector` (OpenAI `text-embedding-3-small`)
- `keywords[]` — extracted for fast text search

Used by chat and the AI-narrative features for cosine-similarity RAG (`<=>` operator on pgvector) before the prompt is sent to the LLM.

### How the structured KB was actually built

To be honest about provenance: the KB tables were **lifted from hardcoded maps inside the service code**, then i18n-ed. Each seed file in `apps/api/prisma/seed-kb/data/*.json` carries an inline `_source` field documenting exactly which file/function the rows came from — e.g. `planets.json`'s rows came from `daily-briefing.service.ts`'s `PLANET_ACTIVITIES` / `mantras` / `remedies` tables, with Hindi names mined from `apps/web/src/i18n/panchang-terms.ts`. The other 11 locales are filled by `npm run kb:backfill`, which uses the LLM to translate English rows into the target locales (one-shot; results are reviewed before merging).

### Classical sources the KB is aligned with

The seed comments cite the canonical references the data was checked against. These are the *traditions* the rows align with, not literal sources we ingested:

| Tradition | Canon |
|---|---|
| Vedic (Jyotish) | **Brihat Parashara Hora Shastra (BPHS)** — planet attributes, sattvic / rajasic / tamasic temperament, the 27-nakshatra cycle, 16-tithi cycle, 27-yoga cycle, dosha definitions |
| Vedic ayanamsa | **Lahiri ayanamsa** — canonical sidereal zero point used for all Swiss Ephemeris sidereal calls |
| Western | **Ptolemy — Tetrabiblos** — tropical zodiac signs, four elements, three modalities |
| Hellenistic | **Vettius Valens — Anthology**; **Dorotheus of Sidon — Carmen Astrologicum** — sect, planetary joys, profections, zodiacal releasing |
| Modern Hellenistic revival | **Chris Brennan — Hellenistic Astrology**; **Robert Hand**; **Demetra George — Ancient Astrology** — sect-role labels, joy interpretations |
| Numerology | **Chaldean / Pythagorean synthesis** — single-digit 1–9 plus master numbers 11/22/33 |
| Chinese | Standard 12-animal × 5-element zodiac; classical Feng Shui flying-stars 9-palace grid |

For RAG-style features (chat, palmistry, tarot, vastu, reports), the long-form content in `knowledge_documents` is operator-curated and embedded at insert time. Each row's `source` column records its provenance for licensing and re-translation purposes.

### AI flow

```
                ┌────────────────────────────────────────┐
   request ───▶ │ feature service (chat / palmistry /    │
                │ tarot / vastu / report)                │
                └─────────────────┬──────────────────────┘
                                  │  optional: pgvector top-K from
                                  │  knowledge_documents → system prompt
                                  ▼
                ┌────────────────────────────────────────┐
                │  LlmService.chatCompletion(...)         │
                │   1. Redis cache GET (60-min TTL)       │
                │      └─► hit? return, log cacheHit=true │
                │   2. Try OpenAI                         │
                │   3. On 4xx / 5xx / timeout → Gemini    │
                │   4. On 4xx / 5xx / timeout → Anthropic │
                │   5. Record to llm_usage (partitioned): │
                │      provider, model, feature, tokens,  │
                │      USD cost, durationMs, errorCode,   │
                │      retryCount, cacheHit               │
                │   6. Cache SET on success               │
                └─────────────────┬──────────────────────┘
                                  ▼
                            response to user
                            (refunded credit on any throw)
```

Provider availability is gated by `site_settings`:

- `llm.provider.openai.enabled` — admin kill-switch (true / false)
- `llm.provider.<n>.enabled` — same per provider
- `llm.<feature>.model` — per-feature model override (e.g. `llm.chat.model = gpt-4o-mini`)
- `llm.<feature>.temperature` — per-feature creativity dial
- `llm.cost.<model>.prompt` and `.completion` — USD per 1M tokens (admin overrides without redeploy)

The settings are reloaded every 30 seconds, so an admin can flip a provider off mid-incident from the LLM tab without restarting the API. Every call lands in `llm_usage` and feeds the Cost / Ops admin tabs, which is how MTD spend, error rate, p50/p95/p99 latency, cache hit %, and the Holt-Winters cost forecast are computed.

### Default per-feature models

Configured in `site_settings` (overridable from the admin LLM tab):

| Feature | Default model | Rationale |
|---|---|---|
| Chat | `gpt-4o-mini` | High-volume, cheap, fast |
| Palmistry (vision) | `gpt-4o-mini` | Vision-capable + cheap |
| Tarot interpretation | `gpt-4o-mini` | Short narrative |
| Vastu narrative | `gpt-4o-mini` | Short narrative |
| Briefing personalization | `gpt-4o-mini` | Short narrative |
| Report generation | `gpt-4o` | Long-form, multi-section, higher precision |
| Embeddings | `text-embedding-3-small` | 1536-dim, $0.02/1M tokens |

The deterministic features (kundli, matching, panchang, etc.) **never call an LLM** — they're a Swiss Ephemeris computation joined with KB rows, which is why their cost-per-request is effectively zero and they always return identical results for identical inputs.

## Local development

### Prerequisites

- Node.js 20+
- Docker Desktop / docker compose
- A few dollars of OpenAI / Gemini credits (optional — chat falls back to KB if no LLM key is set)

### Setup

```bash
git clone https://github.com/xploroshan/myastro360.git
cd myastro360

# Bring up Postgres 16 + pgvector, Redis 7, pgbouncer, pgAdmin
docker compose up -d postgres redis pgbouncer pgadmin

# Install monorepo deps
npm install

# Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Edit apps/api/.env — fill in JWT_SECRET / JWT_REFRESH_SECRET (any 32+ chars for dev),
# OPENAI_API_KEY (or leave blank to use KB fallback), and confirm DATABASE_URL points
# to the local pgbouncer (port 6432).

# Run migrations + seed
cd apps/api
npx prisma migrate deploy
npx prisma db seed   # optional — populates KB tables
cd ../..

# Start everything via turbo
npm run dev
```

The web app comes up on `http://localhost:3000`, the API on `http://localhost:4000`, with Swagger docs at `http://localhost:4000/api/docs`.

### Common scripts

```bash
npm run dev                    # Run web + api concurrently (turbo)
npm run dev:web                # Just the Next.js app
npm run dev:api                # Just the NestJS API
npm run build                  # Build all apps
npm run lint                   # Lint all apps

cd apps/api
npm run build                  # nest build
npm test                       # Jest unit tests
npm run test:int               # Integration tests (spawns its own pg/redis)
npm run test:k6:all            # k6 load test suite
npx prisma migrate deploy      # Apply pending migrations
npx prisma studio              # Browse DB

cd apps/web
npm run lint                   # ESLint flat config (Next 16)
npm test                       # Vitest unit + RTL
npm run test:e2e               # Playwright E2E (chromium)
```

### Useful URLs in dev

| Path | Purpose |
|---|---|
| `http://localhost:4000/api/docs` | Swagger / OpenAPI |
| `http://localhost:4000/api/health/ready` | DB + Redis readiness |
| `http://localhost:4000/api/metrics` | Prometheus metrics |
| `http://localhost:5050` | pgAdmin (creds in `.env`) |
| `http://localhost:3000/admin` | Admin dashboard (after promoting a user to ADMIN) |

To promote your local user to admin:

```bash
psql $DATABASE_URL -c "UPDATE users SET role='ADMIN' WHERE email='you@example.com';"
```

…or set `ADMIN_PROMOTE_EMAILS=you@example.com` in `apps/api/.env` before booting — the bootstrap service runs at every API start and promotes any matching email.

## Deployment

### Production stack

| Surface | Provider | Notes |
|---|---|---|
| Web | Vercel | Auto-deploys `main` from GitHub. `vercel.json` at repo root sets the install command for the monorepo. |
| API | Railway | Watches `apps/api/**`. Builds from `apps/api/Dockerfile`. Healthcheck `/api/health/ready`. |
| Postgres | Supabase (`ap-south-1`) | Pooler URL on `:6543` for runtime, direct URL on `:5432` for migrations. pgvector extension required. |
| Redis | Upstash (`ap-south-1`) | TLS (`rediss://`). `noeviction` policy required by BullMQ. |
| Storage | Cloudflare R2 | Palm uploads, PDF reports. Custom domain `uploads.myastro360.com`. |
| DNS / CDN | Cloudflare | `www.myastro360.com` proxied; `api.myastro360.com` DNS-only. |
| LLM | OpenAI · Gemini · Anthropic | Failover order configurable in `site_settings` table. |
| Errors | Sentry | Both API and web instrumented. |

### Deployment flow

1. Push to `main` (or merge a PR).
2. Vercel auto-builds the web app and rolls forward.
3. Railway sees the change under `apps/api/**`, builds the Dockerfile, runs `npx prisma migrate deploy && node dist/main`.
4. `.github/workflows/publish-api.yml` independently pushes a tagged container to GHCR (`ghcr.io/xploroshan/myastro360-api:latest` and `:sha-<commit>`) for K8s deploys.

For the long-form deployment guide — Supabase + Upstash + Railway setup, custom-domain wiring, K8s migration plan, monitoring hookup, and cost summary — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

### Environment variables

Required for production (full list in `apps/api/.env.example`):

```
DATABASE_URL                  # Supabase pooler URL (port 6543, ?pgbouncer=true)
DIRECT_URL                    # Supabase direct URL (port 5432) — for migrations
REDIS_URL / REDIS_HOST / REDIS_PORT
JWT_SECRET / JWT_REFRESH_SECRET
OPENAI_API_KEY · GEMINI_API_KEY · ANTHROPIC_API_KEY
LLM_FAILOVER_ENABLED=true
RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME / R2_PUBLIC_URL
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
FIREBASE_PROJECT_ID / FIREBASE_SERVICE_ACCOUNT_JSON
SENTRY_DSN
CORS_ORIGIN=https://www.myastro360.com

# Optional / tunable:
FREE_MONTHLY_CREDITS=10
KUNDLI_CREDIT_COST=2
CHAT_CREDIT_COST=1
PALMISTRY_CREDIT_COST=3
REPORT_CREDIT_COST=5
```

Numeric env vars (anything `*_CREDIT_COST`, `PORT`, `OTP_LENGTH`, etc.) are parsed via `parseIntEnv()` — non-numeric values fall back to the documented default and emit a `[config]` warning at boot. This is deliberate: a typo in Railway shouldn't silently break a paid feature (a real bug we hit and fixed — see commit `ea1be1f`).

## API surface

All routes are mounted under `/api` (via NestJS global prefix). Auth-required routes use `JwtAuthGuard`; admin routes additionally use `AdminGuard`.

### Public

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Email + password signup |
| `POST` | `/api/auth/login` | Returns `{ accessToken, refreshToken }` |
| `POST` | `/api/auth/otp/send` · `/verify` | SMS OTP flow |
| `POST` | `/api/auth/google` · `/apple` · `/firebase` | OAuth providers |
| `POST` | `/api/auth/refresh` | Refresh-token rotation (family-tracked) |
| `GET` | `/api/astrology/horoscope/:sign` · `/multi` | Daily/weekly/monthly/yearly |
| `GET` | `/api/astrology/panchang` | Hindu calendar |
| `GET` | `/api/astrology/chinese-zodiac/:year` | Animal + element |
| `GET` | `/api/astrology/traditions` | List of supported traditions |
| `GET` | `/api/payments/pricing` | Pricing config (subs + credit packs + reports) |
| `GET` | `/api/health/live` · `/ready` | Liveness + readiness |
| `GET` | `/api/metrics` | Prometheus |

### Authenticated, credit-spending

| Method | Path | Cost (default) |
|---|---|---|
| `POST` | `/api/chat/message` · `/stream` | 1 |
| `POST` | `/api/astrology/kundli` | 2 |
| `POST` | `/api/astrology/matching` | 2 |
| `POST` | `/api/astrology/divisional/:type` · `/kp-chart` · `/bazi` · `/western/*` · `/hellenistic/*` · `/horary/ask` · `/medical/decumbiture` | 2 |
| `POST` | `/api/palmistry/analyze` | 3 |
| `POST` | `/api/tarot/draw` | per-spread (1–5) |
| `POST` | `/api/vastu/analyze` | 2 |
| `POST` | `/api/reports/generate` | 5 |
| `POST` | `/api/numerology/name` · `/brand` | free |

Every credit deduction goes through `UserService.deductWithRefund(userId, cost, description, work)` which atomically debits, runs the work, and **refunds on any thrown error** (typed as `ADMIN_GRANT` so the user sees the refund in their Credits sub-tab).

### Admin (`AdminGuard`)

A 35+ endpoint surface under `/api/admin/*`. Highlights:

- `GET /admin/dashboard` · `/users` · `/users/:id` · `/payments` · `/chats`
- `PUT /admin/users/:id` · `POST /admin/users/:id/credits/grant` · `/impersonate` · `/force-logout`
- `GET /admin/funnel` · `/cohorts` · `/mrr` · `/churn-risk` · `/payment-failures`
- `GET /admin/ops/llm-health` · `/queues` · `/health` · `/forecast/capacity`
- `GET /admin/cost/summary` · `/by-feature` · `/by-provider` · `/daily` · `/forecast/cost`
- `GET /admin/safety/flagged` · `POST /admin/safety/flagged/:id/resolve`
- `GET /admin/gdpr/requests` · `POST /admin/gdpr/requests` · `/:id/fulfill` · `/:id/reject`
- `POST /admin/llm/provider/:name/disable` · `/enable` · `/keys/:provider/rotate` · `/admin/broadcast`
- `GET /admin/activity` · `POST /admin/activity/:id/undo`
- `GET /admin/settings` · `PUT /admin/settings` (allowed prefixes: `pricing.*`, `feature.*`, `display.*`, `notification.*`, `llm.*`)

Full Swagger at `${API}/api/docs` in non-production environments.

## Database

37 Prisma models in `apps/api/prisma/schema.prisma`. Highlights:

- **Core**: `User`, `Subscription`, `CreditTransaction`, `Payment`, `SiteSetting`.
- **Astrology**: `KundliChart`, `MatchingResult`, `TarotReading`, `PalmistryReading`, `Report`, `Notification`.
- **Chat**: `ChatSession`, `ChatMessage` *(partitioned by `createdAt`, monthly)*.
- **Knowledge base**: 17 `Kb*` tables (planets, nakshatras, tithis, yogas, varas, doshas, zodiac signs, Chinese animals, Hellenistic planets, business sectors, personal-year themes, report sections, briefing phrases, …) — every row carries an `i18n` JSON keyed by locale. Plus `KnowledgeDocument` with a 1536-dim pgvector embedding column.
- **Operations**: `LlmUsage` *(partitioned)*, `ActivityLog` *(partitioned)*, `StatDaily` rollups.
- **Compliance**: `FlaggedMessage`, `GdprRequest`.

Partitioned tables (`chat_messages`, `notifications`, `llm_usage`, `activity_logs`) are partitioned monthly on `createdAt` so retention pruning is a partition drop, not a `DELETE`.

Migrations live in `apps/api/prisma/migrations/` and run automatically at container start (`prisma migrate deploy` in the Dockerfile CMD).

## Background jobs

BullMQ on the same Redis instance. Three queues:

| Queue | Processor | Behavior |
|---|---|---|
| `report-generation` | `ReportProcessor` | LLM-generated PDF, uploaded to R2. 3 retries, exp backoff 5s. |
| `palmistry-analysis` | `PalmistryProcessor` | OpenAI Vision palm reading. 3 retries. |
| `broadcast` | `BroadcastProcessor` | Admin notification fan-out (audience filters: all / premium / locale). 2 retries, 10s backoff. |

Queue depth is exposed at `GET /api/admin/ops/queues` and rendered in the Ops admin tab.

## Observability

- **Prometheus** at `GET /api/metrics` (request latency histograms, status-code counts, queue depths).
- **OpenTelemetry** wired in `apps/api/src/tracing.ts` — set `OTEL_EXPORTER_OTLP_ENDPOINT` to forward (Grafana Cloud OTLP works on the free tier).
- **Sentry** on both apps via `SENTRY_DSN`.
- **Activity audit log** captures every admin mutation (`previousData`/`newData` snapshots) with one-click undo for credit grants and role changes.
- **LLM usage** is recorded per call: provider, model, feature, tokens, USD cost, duration, cache-hit, error-code, retry-depth — feeds the Cost and Ops tabs.
- **Healthcheck** `GET /api/health/ready` checks DB + Redis; `GET /api/health/live` is a heartbeat.

## Admin dashboard

Eleven lazy-loaded tabs under `/admin`:

| Tab | What's there |
|---|---|
| **Dashboard** | KPIs (users, premium, MRR, sessions, credits used) |
| **Users** | Paginated list with `Usage` column (used / given). Inline role change. Per-user detail panel with overview / subscriptions / payments / chats / credits / reports tabs. **Grant Credits** button. Impersonate. Force logout. |
| **Activity** | Filterable audit log. Undo. |
| **Analytics** | Revenue trend, feature usage, **Credits Spent by Feature (7d)**, retention, conversion. |
| **LLM** | Provider toggles, cost overrides, key rotation. |
| **Content** | Knowledge-base counts. |
| **Cost** | MTD spend, daily series, by-feature/provider, Holt-Winters cost forecast with ±1σ band. |
| **Funnel** | Acquisition funnel, weekly cohorts, payment failures. |
| **Ops** | LLM error rate, p50/p95/p99 latency, cache hit, queue depths, capacity forecast. |
| **Safety** | OpenAI moderation queue. Approve / hide / actioned. |
| **GDPR** | Export and delete requests with SLA tracker. |

## Pricing & credits

Defaults shipped in `apps/api/src/config/configuration.ts`. All overridable from Railway env vars or, for runtime tuning, from the `site_settings` table.

| Plan | Price | What you get |
|---|---|---|
| Free | ₹0 | 10 credits on signup |
| Monthly | ₹499 | Unlimited |
| Annual | ₹4,999 | Unlimited (2 months free) |

Credit packs (one-time): 25 / 75 / 200 credits at ₹99 / ₹249 / ₹599. PDF reports run ₹599–₹999.

Default credit costs:

| Feature | Credits |
|---|---|
| Chat message | 1 |
| Kundli / matching / divisional / KP / BaZi / synastry / etc. | 2 |
| Vastu | 2 |
| Palmistry | 3 |
| Tarot (single / three / Celtic) | 1 / 2 / 5 |
| PDF report | 5 |
| Numerology | 0 (free) |

## Project conventions

- **Migrations** are append-only — never edit a merged migration. Add a new file under `apps/api/prisma/migrations/<TIMESTAMP>_name/migration.sql`.
- **Numeric env vars** must go through `parseIntEnv()` (config layer) so a typo doesn't produce `NaN`.
- **Credit-spending features** must use `UserService.deductWithRefund(userId, cost, description, work)` so failures auto-refund.
- **Raw SQL on `llm_usage`** uses mixed casing because the table was created in two stages — original columns are `"createdAt"`/`"userId"` (camelCase, quoted), the four ops-telemetry columns added later are `"cache_hit"`/`"error_code"`/`"duration_ms"`/`"retry_count"` (snake_case). Prisma model fields carry `@map(...)` for the snake_case ones.
- **Partitioned tables** can't have inbound foreign keys; integrity is application-level.
- **Admin mutations** must write an `ActivityLog` entry with `previousData` + `newData`.

## License

Proprietary — all rights reserved.

## Disclaimer

myastro360 is for entertainment and spiritual-guidance purposes only and is not a substitute for professional medical, legal, or financial advice.
