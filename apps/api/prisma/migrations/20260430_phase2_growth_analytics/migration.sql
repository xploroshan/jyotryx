-- Phase 2 growth & retention analytics.
--
-- Adds dimensional columns on `users` (locale / country / signupSource)
-- that power per-locale funnel + cohort queries, and rollup columns on
-- `stats_daily` (mrrUsd / churnedCount / paymentFails) that the new
-- admin MRR tile reads without having to re-aggregate every render.
--
-- Column names stay camelCase to match the existing convention on both
-- tables (see prior users/stats_daily migrations). All new columns are
-- nullable or defaulted so the ALTER TABLE is non-blocking and
-- historical rows stay valid. Indexes on users (locale) and users
-- (createdAt, locale) back the cohort/funnel query plans.

ALTER TABLE "users"
  ADD COLUMN "locale"        VARCHAR(10),
  ADD COLUMN "country"       VARCHAR(2),
  ADD COLUMN "signupSource"  VARCHAR(32);

CREATE INDEX "users_locale_idx"             ON "users" ("locale");
CREATE INDEX "users_createdAt_locale_idx"   ON "users" ("createdAt", "locale");

ALTER TABLE "stats_daily"
  ADD COLUMN "mrrUsd"       DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "churnedCount" INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN "paymentFails" INTEGER        NOT NULL DEFAULT 0;
