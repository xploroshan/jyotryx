-- Add nullable primaryTradition column so users can pick a focus/default
-- tradition for their UI. Null = no preference (first of astrologyTraditions
-- wins on the client).
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "primaryTradition" "AstrologyTradition";
