-- Phase B4: Hellenistic sect-aware planet overlay.
--
-- Adds a dedicated table for the 7 classical planets' Hellenistic
-- characterization — sect alignment (diurnal / nocturnal / flexible),
-- house of joy, sect role (sect light / benefic / malefic / neutral),
-- and a prose description of the planet's character under Greco-Roman
-- astrology. Kept separate from `kb_planets` because the payload shape
-- is meaningfully different (no mantras / remedies / color; classical
-- Hellenistic astrology does not use those).
--
-- Consumed by the Hellenistic endpoints in astrology.service.ts —
-- getHellenisticProfections / getZodiacalReleasing / getHoraryAsk —
-- to enrich the `lordOfYear` / `majorLord` / `querent lord` fields
-- with classical context.
--
-- Shape follows every other Kb* table so the existing backfill-locales
-- script picks it up automatically once registered in
-- prisma/seed-kb/index.ts.

CREATE TABLE "kb_hellenistic_planets" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_hellenistic_planets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_hellenistic_planets_key_tradition_key" ON "kb_hellenistic_planets" ("key", "tradition");
CREATE UNIQUE INDEX "kb_hellenistic_planets_key_shared_key" ON "kb_hellenistic_planets" ("key") WHERE "tradition" IS NULL;
