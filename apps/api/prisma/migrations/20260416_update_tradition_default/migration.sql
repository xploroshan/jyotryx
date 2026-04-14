-- Update the default astrologyTraditions to include all six traditions.
-- Split from 20260415 because Postgres requires the new enum values to be
-- committed before they can be referenced in a DEFAULT expression.
ALTER TABLE "users"
  ALTER COLUMN "astrologyTraditions"
  SET DEFAULT ARRAY['VEDIC','WESTERN','CHINESE','HELLENISTIC','HORARY','MEDICAL']::"AstrologyTradition"[];
