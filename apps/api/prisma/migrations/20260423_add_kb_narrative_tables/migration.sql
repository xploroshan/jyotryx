-- Phase A1b: narrative KB tables for daily-briefing user-overlay fields.
--
-- Adds two tables so the daily briefing can render `professionInsight`,
-- greeting/quality/transit phrases, and the summary template entirely from
-- the KB — eliminating the second translateFields() call per request.
--
--   * kb_profession_insights : rows keyed "{PROFESSION}:{Planet}" e.g.
--                               "SOFTWARE:Sun"; payload { insight: string }.
--                               70 rows at steady state (10 professions ×
--                               7 classical planets).
--   * kb_briefing_phrases    : rows keyed by phrase id, e.g.
--                               "greeting.morning", "quality.excellent",
--                               "transit.saturn_return", "summary.template";
--                               payload { text: string }.
--
-- Shape matches the other Kb* tables so the existing backfill-locales script
-- picks them up automatically once registered in prisma/seed-kb/index.ts.

-- ─── KbProfessionInsight ────────────────────────────────────────────────────
CREATE TABLE "kb_profession_insights" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_profession_insights_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_profession_insights_key_tradition_key" ON "kb_profession_insights" ("key", "tradition");
CREATE UNIQUE INDEX "kb_profession_insights_key_shared_key" ON "kb_profession_insights" ("key") WHERE "tradition" IS NULL;

-- ─── KbBriefingPhrase ───────────────────────────────────────────────────────
CREATE TABLE "kb_briefing_phrases" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_briefing_phrases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_briefing_phrases_key_tradition_key" ON "kb_briefing_phrases" ("key", "tradition");
CREATE UNIQUE INDEX "kb_briefing_phrases_key_shared_key" ON "kb_briefing_phrases" ("key") WHERE "tradition" IS NULL;
