-- Add an optional informal nickname users can set in their profile.
--
-- Used by the frontend to address the user in greetings, the chat
-- surface, and feature-page heroes ("Sumanth's Vedic chart" → "Sums'
-- Vedic chart" if they set their nickname to "Sums"). Astrology
-- artefacts (kundli reports, matching, dasha printouts) continue to
-- use the formal `name` column.
--
-- Nullable — existing rows are unaffected. Front-end falls back to
-- the formal name when nickname is null/blank.

ALTER TABLE "users" ADD COLUMN "nickname" TEXT;
