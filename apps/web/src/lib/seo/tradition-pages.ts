import type { FeatureMeta } from "./feature-pages";

/**
 * SEO metadata for the tradition/technique tool pages (Tier-B). These routes
 * previously shipped with NO metadata at all — 25 URLs sharing the root
 * layout's generic title, forming a sitewide duplicate-title cluster while
 * each targets a real query class ("dasha calculator", "kp astrology
 * online", "bazi chart") that competitors monetise with dedicated pages.
 *
 * English-root only (no /<locale> variants), so — like HUB_PAGES — these must
 * never join LOCALIZED_PATHS or emit hreflang. The sitemap lists the subset
 * with meaningful search demand (see sitemap.ts).
 *
 * /horary/ask, /horary/history and /decision-room are deliberately absent:
 * they're per-user app surfaces and carry robots noindex instead.
 */
export const TRADITION_PAGES: Record<string, FeatureMeta> = {
  "/vedic": {
    title: "Vedic Astrology (Jyotish) — Charts, Dashas & Remedies",
    description:
      "Explore Vedic astrology (Jyotish): sidereal birth charts, 27 nakshatras, Vimshottari dasha periods, doshas and traditional remedies — computed with Swiss Ephemeris accuracy.",
    keywords: ["vedic astrology", "jyotish", "sidereal astrology", "nakshatra"],
  },
  "/vedic/dasha": {
    title: "Vimshottari Dasha Calculator — Current Mahadasha & Antardasha",
    description:
      "Calculate your Vimshottari dasha periods free: current mahadasha, antardasha and pratyantardasha timeline from your birth details, with plain-language interpretations.",
    keywords: ["dasha calculator", "vimshottari dasha", "mahadasha", "antardasha"],
  },
  "/vedic/dosha": {
    title: "Dosha Check — Mangal, Kaal Sarp & Pitra Dosha Test",
    description:
      "Check your kundli for Mangal (Manglik), Kaal Sarp, Nadi and Pitra dosha — free analysis with severity, cancellation rules and traditional remedies.",
    keywords: ["mangal dosha check", "kaal sarp dosha", "manglik check", "pitra dosha"],
  },
  "/vedic/mulank": {
    title: "Mulank Calculator — Your Root Number & Its Meaning",
    description:
      "Find your mulank (root number) from your birth date and what it reveals about personality, career and relationships in Vedic numerology.",
    keywords: ["mulank calculator", "root number", "mulank"],
  },
  "/western": {
    title: "Western Astrology — Natal Charts, Synastry & Transits",
    description:
      "Western (tropical) astrology tools: natal chart calculator, synastry compatibility and live transit analysis with clear, personalized interpretations.",
    keywords: ["western astrology", "tropical zodiac", "natal chart"],
  },
  "/western/natal": {
    title: "Free Natal Chart Calculator — Western Birth Chart",
    description:
      "Generate your Western natal chart free: planets, houses and aspects from your exact birth time and place, with a readable interpretation of each placement.",
    keywords: ["natal chart calculator", "birth chart free", "western birth chart"],
  },
  "/western/synastry": {
    title: "Synastry Chart Calculator — Relationship Compatibility",
    description:
      "Compare two birth charts with a free synastry analysis — inter-chart aspects, element balance and a clear read on relationship strengths and frictions.",
    keywords: ["synastry chart", "synastry calculator", "astrology compatibility"],
  },
  "/western/transits": {
    title: "Transit Chart Today — Current Planetary Transits",
    description:
      "See today's planetary transits against your natal chart — which aspects are active now, what they mean, and when they peak.",
    keywords: ["transit chart", "current transits", "planetary transits today"],
  },
  "/chinese": {
    title: "Chinese Astrology — Zodiac Animals, BaZi & Flying Stars",
    description:
      "Chinese astrology tools: your zodiac animal and element, Four Pillars (BaZi) chart, and Flying Stars feng shui analysis.",
    keywords: ["chinese astrology", "chinese zodiac", "bazi"],
  },
  "/chinese/bazi": {
    title: "BaZi Calculator — Four Pillars of Destiny Chart",
    description:
      "Calculate your BaZi (Four Pillars of Destiny) chart free from your birth date and hour — day master, elemental balance and luck pillar analysis.",
    keywords: ["bazi calculator", "four pillars of destiny", "bazi chart"],
  },
  "/chinese/flying-stars": {
    title: "Flying Stars Calculator — Feng Shui Chart by Period",
    description:
      "Generate a Flying Stars (Xuan Kong) feng shui chart for your home's facing direction and period, with room-by-room guidance.",
    keywords: ["flying stars feng shui", "xuan kong", "flying star chart"],
  },
  "/chinese/zodiac": {
    title: "Chinese Zodiac — Find Your Animal Sign & Element",
    description:
      "Find your Chinese zodiac animal and element from your birth year, plus personality traits, compatibility and this year's outlook for your sign.",
    keywords: ["chinese zodiac", "chinese zodiac animals", "what is my chinese zodiac"],
  },
  "/hellenistic": {
    title: "Hellenistic Astrology — Traditional Techniques Online",
    description:
      "Practice Hellenistic astrology online: whole-sign natal charts, annual profections and zodiacal releasing with sect and essential dignities.",
    keywords: ["hellenistic astrology", "traditional astrology"],
  },
  "/hellenistic/natal": {
    title: "Hellenistic Natal Chart — Whole Sign Houses & Dignities",
    description:
      "Cast a Hellenistic natal chart: whole-sign houses, sect, essential dignities and lots, interpreted with traditional methods.",
    keywords: ["hellenistic natal chart", "whole sign houses"],
  },
  "/hellenistic/profections": {
    title: "Annual Profections Calculator — Year Lord & Activated House",
    description:
      "Find your profected house and year lord for the current age year — the classic Hellenistic timing technique, calculated free.",
    keywords: ["annual profections", "profections calculator", "year lord"],
  },
  "/hellenistic/zodiacal-releasing": {
    title: "Zodiacal Releasing Calculator — Peaks & Periods from Spirit",
    description:
      "Run zodiacal releasing from the Lot of Spirit or Fortune: L1/L2 periods, peak chapters and loosing of the bond, computed from your birth chart.",
    keywords: ["zodiacal releasing", "zodiacal releasing calculator"],
  },
  "/medical": {
    title: "Medical Astrology — Body Zodiac & Decumbiture Charts",
    description:
      "Medical astrology tools: the zodiacal body map (melothesia) and decumbiture charts, presented for traditional study and reflection.",
    keywords: ["medical astrology", "melothesia"],
  },
  "/medical/body-zodiac": {
    title: "Body Zodiac Map — Which Sign Rules Each Body Part",
    description:
      "The traditional melothesia map: which zodiac sign rules each part of the body, from Aries (head) to Pisces (feet), and how medical astrologers used it.",
    keywords: ["body zodiac", "zodiac body parts", "melothesia"],
  },
  "/medical/decumbiture": {
    title: "Decumbiture Chart Calculator — Traditional Medical Astrology",
    description:
      "Cast a decumbiture chart for the moment of falling ill — the classical technique for reading crisis days and recovery, computed free.",
    keywords: ["decumbiture chart", "decumbiture astrology"],
  },
  "/horary": {
    title: "Horary Astrology — Ask a Question, Get a Chart Answer",
    description:
      "Horary astrology online: ask a precise question and get a chart cast for that moment, judged with traditional considerations and aspects.",
    keywords: ["horary astrology", "horary chart", "horary question"],
  },
  "/kp-astrology": {
    title: "KP Astrology Online — Sub Lords & Cuspal Chart",
    description:
      "KP (Krishnamurti Paddhati) astrology online: Placidus cusps, star lords and sub lords, significators and ruling planets for precise predictions.",
    keywords: ["kp astrology", "krishnamurti paddhati", "sub lord", "kp chart"],
  },
  "/cosmic-calendar": {
    title: "Cosmic Calendar — Upcoming Transits, Eclipses & Retrogrades",
    description:
      "A day-by-day cosmic calendar of astrological events: planetary transits, retrogrades, eclipses and festival dates — with what each one means for you.",
    keywords: ["astrology calendar", "retrograde calendar", "eclipse dates"],
  },
  "/divisional": {
    title: "Divisional Charts (D1–D60) — Navamsa, Dashamsha & More",
    description:
      "Generate Vedic divisional (varga) charts from D1 to D60 — Navamsa (D9) for marriage, Dashamsha (D10) for career — with per-chart interpretations.",
    keywords: ["divisional charts", "navamsa chart", "d9 chart", "dashamsha"],
  },
};

/** Tradition routes that must stay OUT of the index (per-user app surfaces). */
export const NOINDEX_APP_ROUTES = ["/horary/ask", "/horary/history", "/decision-room"];
