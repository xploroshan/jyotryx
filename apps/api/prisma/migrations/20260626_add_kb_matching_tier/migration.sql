-- Placement library (2/N): Kundli-matching compatibility-tier KB table.
--
-- Compatibility interpretation is tier-driven (the ashtakoota score falls into
-- one of a few bands), so the matching domain needs just 4 rows keyed by tier:
-- "excellent" | "good" | "average" | "low". InterpretationService maps the
-- percentage to a tier and returns the row verbatim — no LLM. Payload mirrors
-- InterpretationResult.
--
--   kb_matching_tiers : 4 rows. Payload
--                       { summary: string, points: string[], guidance: string }.
--
-- English-authored; `npm run kb:backfill -- --tables=matching-tiers` fills the
-- other 11 locales. Until then non-English requests fall through to the
-- localized LLM path (renderStatus().matched), so there is no regression.

CREATE TABLE "kb_matching_tiers" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_matching_tiers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_matching_tiers_key_tradition_key" ON "kb_matching_tiers" ("key", "tradition");
CREATE UNIQUE INDEX "kb_matching_tiers_key_shared_key" ON "kb_matching_tiers" ("key") WHERE "tradition" IS NULL;
