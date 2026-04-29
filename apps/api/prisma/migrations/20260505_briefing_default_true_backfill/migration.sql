-- Daily-briefing email is now opt-out by default.
--
-- Two changes, in order:
--   1. The column default flips from FALSE → TRUE so any newly-created
--      User row automatically opts in.
--   2. Every existing user whose flag is still FALSE is flipped to TRUE.
--      The schema does not distinguish "default false" from "user
--      explicitly opted out" — so this backfill will re-subscribe the
--      few users who had deliberately turned it off. The product owner
--      accepts that trade-off as part of the policy change; users keep
--      one-click opt-out from the profile/notifications page.
--
-- Both statements are idempotent; re-running the migration is a no-op.

ALTER TABLE "users"
  ALTER COLUMN "briefingEmailEnabled" SET DEFAULT TRUE;

UPDATE "users"
SET "briefingEmailEnabled" = TRUE
WHERE "briefingEmailEnabled" = FALSE;
