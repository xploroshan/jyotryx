-- Add new astrology tradition enum values.
-- Note: these must be committed before they can be referenced in
-- defaults/expressions, so the default update happens in the next
-- migration (20260416_update_tradition_default).
ALTER TYPE "AstrologyTradition" ADD VALUE IF NOT EXISTS 'HELLENISTIC';
ALTER TYPE "AstrologyTradition" ADD VALUE IF NOT EXISTS 'HORARY';
ALTER TYPE "AstrologyTradition" ADD VALUE IF NOT EXISTS 'MEDICAL';
