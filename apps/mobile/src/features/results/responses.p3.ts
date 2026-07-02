/**
 * Response shapes for the P3 traditions (Western / Chinese / Hellenistic /
 * Horary / Medical), transcribed from the web clients — render contracts only.
 */

// ── Western ──
export interface WesternNatalData {
  ascendant: { sign: string; degree: number };
  planets: { planet: string; sign: string; degree: number; house: number | null }[];
  interpretation?: string;
}
export interface TransitsData {
  date: string;
  transitingPlanets: { planet: string; sign: string; degree: number; longitude: number }[];
  aspects: { transiting: string; natal: string; aspect: string; orb: number }[];
  interpretation: string;
}
export interface SynastryData {
  partner1: { ascendant: { sign: string; degree: number }; sun: { sign: string; element: string; modality: string }; moon: { sign: string } };
  partner2: { ascendant: { sign: string; degree: number }; sun: { sign: string; element: string; modality: string }; moon: { sign: string } };
  aspects: { a: string; b: string; aspect: string; orb: number; quality: 'harmonious' | 'challenging' }[];
  compatibility: { score: number; harmonious: number; challenging: number; summary: string };
}

// ── Chinese ──
export interface BaZiPillar {
  heavenlyStem: string;
  earthlyBranch: string;
  animal: string;
  element: string;
}
export interface BaZiData {
  pillars: { year: BaZiPillar; month: BaZiPillar; day: BaZiPillar; hour: BaZiPillar };
  dayMaster: string;
  elementBalance: Record<string, number>;
  interpretation: string;
}
export interface ChineseZodiacData {
  animal: string;
  element: string;
  yinYang: string;
  traits: string[];
  interpretation?: string;
  year?: number;
}
export interface FlyingStarsData {
  year: number;
  centerStar: number;
  centerMeaning: string;
  grid: number[][];
  meanings: Record<string, string>;
  interpretation: string;
}

// ── Hellenistic ── (natal reuses the Vedic KundliData shape)
export interface ProfectionsData {
  ageYears: number;
  profectedHouse: number;
  profectedSign: string;
  lordOfYear: string;
  interpretation?: string;
}
export interface ZodiacalReleasingData {
  ageYears: number;
  majorPeriod: { sign: string; lord: string; description: string };
  minorPeriod: { sign: string; lord: string; description: string };
  interpretation: string;
}

// ── Horary ──
export interface HoraryChart {
  ascendant: { sign: string; degree: number };
  significators: { querent: string; quesited: string; moon: string };
}
export interface HoraryData {
  question: string;
  askedAt: string;
  chart: HoraryChart;
  judgment: string;
}

// ── Medical ──
export interface DecumbitureData {
  decumbitureAt: string;
  symptoms: string | null;
  ascendant: { sign: string; degree: number };
  ascendantElement: string;
  sixthHouseSign: string;
  moon: { sign: string; degree: number } | null;
  guidance: string;
  interpretation: string;
}
export interface BodyZodiacData {
  mapping: { sign: string; bodyParts: string[]; element: string; guidance?: string }[];
}
