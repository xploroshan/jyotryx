-- Placement library (3/N): Kundli placement tables.
--
-- Lets the interpretation endpoint assemble a Kundli reading from the KB instead
-- of the LLM: an ascendant headline (kb_sign_traits) plus one concise insight
-- per planet placement (kb_planet_in_house, 9 grahas x 12 houses = 108 rows).
--
--   kb_sign_traits     : 12 rows keyed by rising sign. Payload
--                        { summary: string, guidance: string }.
--   kb_planet_in_house : 108 rows keyed "{Planet}:{house}". Payload
--                        { text: string }.
--
-- English-authored; `npm run kb:backfill -- --tables=sign-traits,planet-in-house`
-- fills the other 11 locales. Until then non-English kundli requests fall through
-- to the localized LLM path (renderStatus().matched) — no regression.

CREATE TABLE "kb_sign_traits" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_sign_traits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_sign_traits_key_tradition_key" ON "kb_sign_traits" ("key", "tradition");
CREATE UNIQUE INDEX "kb_sign_traits_key_shared_key" ON "kb_sign_traits" ("key") WHERE "tradition" IS NULL;

CREATE TABLE "kb_planet_in_house" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_planet_in_house_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_planet_in_house_key_tradition_key" ON "kb_planet_in_house" ("key", "tradition");
CREATE UNIQUE INDEX "kb_planet_in_house_key_shared_key" ON "kb_planet_in_house" ("key") WHERE "tradition" IS NULL;
