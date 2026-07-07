/**
 * Single source of truth for the SEO metadata of the Tier-A feature pages —
 * the marketing/tool pages whose UI copy is fully translated in every locale
 * file, so they can be localized at `/<locale>/…` with server-rendered
 * content (no thin duplicates).
 *
 * Both the English root wrappers (`app/<page>/page.tsx`) and the localized
 * wrappers (`app/[locale]/<page>/page.tsx`) read from here, so titles,
 * descriptions and the hreflang set never drift apart.
 */
export interface FeatureMeta {
  title: string;
  description: string;
  keywords?: string[];
}

export const FEATURE_PAGES: Record<string, FeatureMeta> = {
  "/": {
    title: "MyAstro360 — Vedic Astrology, Kundli, Horoscope & Palm Reading",
    description:
      "Instant, personalized Vedic astrology — free Kundli, daily horoscopes, Kundli matching, palmistry, numerology and panchang. Talk to astrologers 24/7.",
  },
  "/kundli": {
    title: "Free Kundli Online — Janam Kundali & Birth Chart",
    description:
      "Generate your free Janam Kundali (birth chart) instantly with Swiss Ephemeris accuracy — planetary positions, dashas, doshas and personalized predictions.",
    keywords: ["free kundli", "janam kundali", "birth chart", "vedic astrology", "horoscope chart"],
  },
  "/numerology": {
    title: "Free Numerology Calculator — Name & Birth Numbers",
    description:
      "Discover your numerology profile — life path, destiny and name numbers — with a free instant calculator and a clear, personalized interpretation.",
    keywords: ["numerology calculator", "life path number", "destiny number", "name numerology"],
  },
  "/tarot": {
    title: "Free Online Tarot Card Reading",
    description:
      "Get a free online tarot reading for love, career and life questions — with clear card meanings and personalized guidance. Instant and private.",
    keywords: ["tarot reading", "free tarot", "online tarot cards", "love tarot"],
  },
  "/matching": {
    title: "Kundli Matching for Marriage — Guna Milan",
    description:
      "Free online Kundli matching (Guna Milan / Ashtakoot) for marriage compatibility — 36-guna score, Mangal dosha check and a detailed compatibility report.",
    keywords: ["kundli matching", "guna milan", "marriage compatibility", "ashtakoot", "mangal dosha"],
  },
  "/vastu": {
    title: "Vastu Shastra Tips & Consultation Online",
    description:
      "Vastu Shastra guidance for home and office — directions, room placement and practical remedies to improve harmony, health and prosperity.",
    keywords: ["vastu shastra", "vastu tips", "vastu for home", "vastu consultation"],
  },
  "/muhurat": {
    title: "Shubh Muhurat — Auspicious Dates & Timings",
    description:
      "Find the shubh muhurat (auspicious timing) for marriage, griha pravesh, naming and travel — based on panchang and your birth details.",
    keywords: ["shubh muhurat", "auspicious time", "muhurat for marriage", "griha pravesh muhurat"],
  },
  "/palmistry": {
    title: "Free Palmistry — AI Palm Reading Online",
    description:
      "Free palm reading online — upload a photo of your palm for an AI-assisted analysis of your heart, head, life and fate lines.",
    keywords: ["palmistry", "palm reading", "free palm reading", "hast rekha"],
  },
};

/** Paths (without locale prefix) that have localized variants. */
export const LOCALIZED_PATHS = Object.keys(FEATURE_PAGES);

/**
 * Hub pages: high-priority routes that exist ONLY at the English root — there
 * are no `/<locale>/horoscope` or `/<locale>/panchang` hub routes (only the
 * [sign]/[city] children beneath them). Kept SEPARATE from FEATURE_PAGES on
 * purpose: LOCALIZED_PATHS is derived from FEATURE_PAGES keys and drives the
 * sitemap's localized fan-out, so adding these there would sitemap URLs that
 * 404. Consequently hub metadata must NOT set `hreflang`.
 */
export const HUB_PAGES: Record<string, FeatureMeta> = {
  "/horoscope": {
    title: "Today's Horoscope — Daily, Weekly, Monthly & Yearly for All 12 Signs",
    description:
      "Free daily horoscope for all 12 zodiac signs — today's predictions for love, career and health, plus weekly, monthly and yearly forecasts across Vedic, Western and Chinese traditions.",
    keywords: ["horoscope", "today's horoscope", "daily horoscope", "rashifal", "zodiac signs"],
  },
  "/panchang": {
    title: "Aaj Ka Panchang — Today's Tithi, Nakshatra & Rahu Kaal",
    description:
      "Today's Panchang (Hindu calendar): tithi, nakshatra, yoga, karana, sunrise, sunset, Rahu Kaal and Gulika Kaal — computed from Swiss Ephemeris, with city-accurate timings for 50+ Indian cities.",
    keywords: ["panchang", "aaj ka panchang", "today panchang", "tithi today", "rahu kaal today"],
  },
  "/pricing": {
    title: "Pricing & Plans — Astrology Consultations and Reports",
    description:
      "Simple, transparent pricing for MyAstro360 — free kundli and horoscopes, plus affordable credits and plans for detailed reports and astrologer consultations.",
  },
};
