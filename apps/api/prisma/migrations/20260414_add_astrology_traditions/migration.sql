-- CreateEnum
CREATE TYPE "AstrologyTradition" AS ENUM ('VEDIC', 'WESTERN', 'CHINESE');

-- AlterTable: add astrologyTraditions column with default [VEDIC]
ALTER TABLE "users" ADD COLUMN "astrologyTraditions" "AstrologyTradition"[] NOT NULL DEFAULT ARRAY['VEDIC']::"AstrologyTradition"[];
