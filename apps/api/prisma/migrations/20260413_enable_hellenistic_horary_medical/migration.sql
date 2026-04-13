-- Add new astrology tradition enum values
ALTER TYPE "AstrologyTradition" ADD VALUE 'HELLENISTIC';
ALTER TYPE "AstrologyTradition" ADD VALUE 'HORARY';
ALTER TYPE "AstrologyTradition" ADD VALUE 'MEDICAL';

-- Update default to include all traditions
ALTER TABLE "users" ALTER COLUMN "astrologyTraditions" SET DEFAULT ARRAY['VEDIC','WESTERN','CHINESE','HELLENISTIC','HORARY','MEDICAL']::"AstrologyTradition"[];
