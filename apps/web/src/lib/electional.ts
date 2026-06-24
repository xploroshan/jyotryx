/**
 * Shared constants for the electional-timing UIs (Decision Room + Cosmic
 * Calendar). Kept in one place so both pages score against the same activity
 * list, the same fixed-coordinate cities, and the same recommendation palette.
 */

export type Recommendation = "excellent" | "good" | "neutral" | "caution" | "avoid";

/** Activity keys — mirror the API's DecisionActivity union and t.decisionRoom.activities. */
export const ACTIVITIES = [
  "marriage",
  "business",
  "travel",
  "griha_pravesh",
  "vehicle",
  "education",
  "medical",
  "general",
] as const;

export type Activity = (typeof ACTIVITIES)[number];

/**
 * A small set of major cities with fixed coordinates keeps verdicts
 * deterministic without a geocoder. Proper nouns stay in Latin.
 */
export const CITIES = [
  { name: "New Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
] as const;

/** Maps our locale codes to Intl locale tags for date formatting. */
export const LOCALE_MAP: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", ta: "ta-IN", te: "te-IN", bn: "bn-IN", mr: "mr-IN",
  gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", pa: "pa-IN", or: "or-IN", as: "as-IN",
};

/** Verdict-card palette (ring + emphasis text + chip), keyed by recommendation. */
export const REC_STYLES: Record<Recommendation, { ring: string; text: string; chip: string }> = {
  excellent: { ring: "ring-emerald-500/40", text: "text-emerald-600", chip: "bg-emerald-500/15 text-emerald-700" },
  good: { ring: "ring-lime-500/40", text: "text-lime-600", chip: "bg-lime-500/15 text-lime-700" },
  neutral: { ring: "ring-amber-500/40", text: "text-amber-600", chip: "bg-amber-500/15 text-amber-700" },
  caution: { ring: "ring-orange-500/40", text: "text-orange-600", chip: "bg-orange-500/15 text-orange-700" },
  avoid: { ring: "ring-red-500/40", text: "text-red-600", chip: "bg-red-500/15 text-red-700" },
};

/** Calendar-cell heat tint, keyed by recommendation. */
export const REC_CELL: Record<Recommendation, string> = {
  excellent: "bg-emerald-500/20 text-emerald-900 hover:bg-emerald-500/30",
  good: "bg-lime-500/15 text-lime-900 hover:bg-lime-500/25",
  neutral: "bg-amber-500/12 text-amber-900 hover:bg-amber-500/20",
  caution: "bg-orange-500/15 text-orange-900 hover:bg-orange-500/25",
  avoid: "bg-red-500/15 text-red-900 hover:bg-red-500/25",
};

/** Today's date as YYYY-MM-DD in the user's local zone. */
export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
