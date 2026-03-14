import { ConsultationCategory, PlanType, ReportType } from "../types";

// ─── Zodiac Signs ───────────────────────────────────────────────────────────

export interface ZodiacSignInfo {
  name: string;
  symbol: string;
  element: string;
  startDate: string; // MM-DD
  endDate: string;   // MM-DD
  rulingPlanet: string;
}

export const ZODIAC_SIGNS: ZodiacSignInfo[] = [
  { name: "Aries", symbol: "Ram", element: "Fire", startDate: "03-21", endDate: "04-19", rulingPlanet: "Mars" },
  { name: "Taurus", symbol: "Bull", element: "Earth", startDate: "04-20", endDate: "05-20", rulingPlanet: "Venus" },
  { name: "Gemini", symbol: "Twins", element: "Air", startDate: "05-21", endDate: "06-20", rulingPlanet: "Mercury" },
  { name: "Cancer", symbol: "Crab", element: "Water", startDate: "06-21", endDate: "07-22", rulingPlanet: "Moon" },
  { name: "Leo", symbol: "Lion", element: "Fire", startDate: "07-23", endDate: "08-22", rulingPlanet: "Sun" },
  { name: "Virgo", symbol: "Maiden", element: "Earth", startDate: "08-23", endDate: "09-22", rulingPlanet: "Mercury" },
  { name: "Libra", symbol: "Scales", element: "Air", startDate: "09-23", endDate: "10-22", rulingPlanet: "Venus" },
  { name: "Scorpio", symbol: "Scorpion", element: "Water", startDate: "10-23", endDate: "11-21", rulingPlanet: "Mars" },
  { name: "Sagittarius", symbol: "Archer", element: "Fire", startDate: "11-22", endDate: "12-21", rulingPlanet: "Jupiter" },
  { name: "Capricorn", symbol: "Goat", element: "Earth", startDate: "12-22", endDate: "01-19", rulingPlanet: "Saturn" },
  { name: "Aquarius", symbol: "Water Bearer", element: "Air", startDate: "01-20", endDate: "02-18", rulingPlanet: "Saturn" },
  { name: "Pisces", symbol: "Fish", element: "Water", startDate: "02-19", endDate: "03-20", rulingPlanet: "Jupiter" },
];

// ─── Consultation Categories ────────────────────────────────────────────────

export interface ConsultationCategoryInfo {
  key: ConsultationCategory;
  label: string;
  description: string;
  icon: string;
  creditCost: number;
}

export const CONSULTATION_CATEGORIES: ConsultationCategoryInfo[] = [
  { key: ConsultationCategory.GENERAL, label: "General", description: "General astrology queries", icon: "stars", creditCost: 1 },
  { key: ConsultationCategory.CAREER, label: "Career", description: "Career and professional guidance", icon: "briefcase", creditCost: 1 },
  { key: ConsultationCategory.RELATIONSHIP, label: "Relationship", description: "Love and relationship advice", icon: "heart", creditCost: 1 },
  { key: ConsultationCategory.HEALTH, label: "Health", description: "Health and wellness insights", icon: "activity", creditCost: 1 },
  { key: ConsultationCategory.FINANCE, label: "Finance", description: "Financial and wealth guidance", icon: "dollar-sign", creditCost: 1 },
  { key: ConsultationCategory.KUNDLI, label: "Kundli", description: "Birth chart analysis", icon: "compass", creditCost: 2 },
  { key: ConsultationCategory.MATCHING, label: "Matching", description: "Kundli matching for compatibility", icon: "users", creditCost: 2 },
  { key: ConsultationCategory.PALMISTRY, label: "Palmistry", description: "Palm reading analysis", icon: "hand", creditCost: 2 },
  { key: ConsultationCategory.REMEDY, label: "Remedies", description: "Astrological remedies and solutions", icon: "shield", creditCost: 1 },
];

// ─── Credit Costs ───────────────────────────────────────────────────────────

export const CREDIT_COSTS = {
  CHAT_MESSAGE: 1,
  KUNDLI_CHART: 2,
  MATCHING: 2,
  PALMISTRY: 2,
  REPORT_LIFE: 5,
  REPORT_CAREER: 5,
  REPORT_MARRIAGE: 5,
  REPORT_WEALTH: 5,
  REPORT_PALM: 3,
  REPORT_ANNUAL: 5,
  DAILY_FREE_CREDITS: 3,
} as const;

// ─── Plan Prices (INR) ─────────────────────────────────────────────────────

export interface PlanInfo {
  type: PlanType;
  name: string;
  priceINR: number;
  priceUSD: number;
  credits: number;
  features: string[];
}

export const PLAN_PRICES: PlanInfo[] = [
  {
    type: PlanType.FREE,
    name: "Free",
    priceINR: 0,
    priceUSD: 0,
    credits: 3,
    features: [
      "3 free credits daily",
      "Basic chat consultations",
      "Limited chat history",
    ],
  },
  {
    type: PlanType.MONTHLY,
    name: "Premium Monthly",
    priceINR: 299,
    priceUSD: 3.99,
    credits: 100,
    features: [
      "100 credits per month",
      "Unlimited chat history",
      "All consultation categories",
      "Kundli chart generation",
      "Kundli matching",
      "Palmistry readings",
      "Priority support",
    ],
  },
  {
    type: PlanType.ANNUAL,
    name: "Premium Annual",
    priceINR: 2399,
    priceUSD: 29.99,
    credits: 1500,
    features: [
      "1500 credits per year",
      "Everything in Monthly plan",
      "2 free detailed reports",
      "Exclusive annual forecast",
      "Priority support",
    ],
  },
];

// ─── Report Types ───────────────────────────────────────────────────────────

export interface ReportTypeInfo {
  type: ReportType;
  name: string;
  description: string;
  priceINR: number;
  priceUSD: number;
  creditCost: number;
}

export const REPORT_TYPES: ReportTypeInfo[] = [
  { type: ReportType.LIFE, name: "Life Report", description: "Comprehensive life analysis based on your birth chart", priceINR: 199, priceUSD: 2.99, creditCost: 5 },
  { type: ReportType.CAREER, name: "Career Report", description: "Detailed career guidance and professional predictions", priceINR: 199, priceUSD: 2.99, creditCost: 5 },
  { type: ReportType.MARRIAGE, name: "Marriage Report", description: "Marriage compatibility and relationship forecast", priceINR: 199, priceUSD: 2.99, creditCost: 5 },
  { type: ReportType.WEALTH, name: "Wealth Report", description: "Financial prospects and wealth-building guidance", priceINR: 199, priceUSD: 2.99, creditCost: 5 },
  { type: ReportType.PALM, name: "Palm Reading Report", description: "Detailed palmistry analysis from your palm image", priceINR: 149, priceUSD: 1.99, creditCost: 3 },
  { type: ReportType.ANNUAL, name: "Annual Forecast", description: "Year-ahead predictions and guidance", priceINR: 249, priceUSD: 3.49, creditCost: 5 },
];

// ─── Misc Constants ─────────────────────────────────────────────────────────

export const MAX_CHAT_HISTORY_LENGTH = 50;
export const MAX_FREE_SESSIONS_PER_DAY = 3;
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const CHAT_MODEL = "gpt-4o";
export const SUPPORTED_LANGUAGES = ["en", "hi", "ta", "te", "bn", "mr", "gu", "kn", "ml"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
