-- Placement library (4/N): the combination tables.
--
-- docs/KB_LLM_DEPENDENCY_AUDIT.md identified the critical gap: the KB had 22
-- tables but they all described SINGLE entities (a planet, a sign, a number).
-- Chart interpretation lives in COMBINATIONS, so every kundli / dasha /
-- divisional / KP / matching reading fell through to the LLM for its meaning
-- layer. These six tables close that gap.
--
--   kb_house_meaning    : 12 rows keyed "1".."12". Payload { text }.
--   kb_planet_in_sign   : 108 rows keyed "{Planet}:{Sign}" (9 grahas x 12 rashis). Payload { text, dignity }.
--   kb_yoga_meaning     : Named-yoga callouts keyed by slug. Payload { name, text }.
--   kb_koota_meaning    : The 8 Ashtakoota factors keyed by slug. Payload { name, text, lowScoreNote }.
--   kb_aspect_meaning   : Graha drishti keyed "{Planet}:{houseOffset}". Payload { text }.
--   kb_transit_alert    : Gochar keyed "{Planet}:{houseFromMoon}". Payload { text, tone }.
--
-- English-authored; `npm run kb:backfill` fills the other 11 locales. Until
-- then non-English requests keep the localized LLM path via
-- renderStatus().matched -- no regression, and each locale flips to KB
-- automatically as its rows land.

CREATE TABLE "kb_house_meaning" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_house_meaning_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_house_meaning_key_tradition_key" ON "kb_house_meaning" ("key", "tradition");
CREATE UNIQUE INDEX "kb_house_meaning_key_shared_key" ON "kb_house_meaning" ("key") WHERE "tradition" IS NULL;

CREATE TABLE "kb_planet_in_sign" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_planet_in_sign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_planet_in_sign_key_tradition_key" ON "kb_planet_in_sign" ("key", "tradition");
CREATE UNIQUE INDEX "kb_planet_in_sign_key_shared_key" ON "kb_planet_in_sign" ("key") WHERE "tradition" IS NULL;

CREATE TABLE "kb_yoga_meaning" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_yoga_meaning_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_yoga_meaning_key_tradition_key" ON "kb_yoga_meaning" ("key", "tradition");
CREATE UNIQUE INDEX "kb_yoga_meaning_key_shared_key" ON "kb_yoga_meaning" ("key") WHERE "tradition" IS NULL;

CREATE TABLE "kb_koota_meaning" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_koota_meaning_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_koota_meaning_key_tradition_key" ON "kb_koota_meaning" ("key", "tradition");
CREATE UNIQUE INDEX "kb_koota_meaning_key_shared_key" ON "kb_koota_meaning" ("key") WHERE "tradition" IS NULL;

CREATE TABLE "kb_aspect_meaning" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_aspect_meaning_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_aspect_meaning_key_tradition_key" ON "kb_aspect_meaning" ("key", "tradition");
CREATE UNIQUE INDEX "kb_aspect_meaning_key_shared_key" ON "kb_aspect_meaning" ("key") WHERE "tradition" IS NULL;

CREATE TABLE "kb_transit_alert" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_transit_alert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_transit_alert_key_tradition_key" ON "kb_transit_alert" ("key", "tradition");
CREATE UNIQUE INDEX "kb_transit_alert_key_shared_key" ON "kb_transit_alert" ("key") WHERE "tradition" IS NULL;

