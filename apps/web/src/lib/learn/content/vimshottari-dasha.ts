import type { LearnArticle } from "../articles";

export const vimshottariDasha: LearnArticle = {
  slug: "vimshottari-dasha",
  title: "Vimshottari Dasha — The 120-Year Planetary Period System",
  description:
    "How Vimshottari dasha works: the 9 mahadasha lords and their durations, how your Moon's nakshatra sets the starting point, and how to find your current period.",
  keywords: [
    "vimshottari dasha",
    "mahadasha",
    "antardasha",
    "dasha calculator",
    "planetary periods",
    "current dasha",
    "saturn mahadasha",
    "rahu mahadasha",
  ],
  datePublished: "2026-07-13",
  dateModified: "2026-07-13",
  hero: {
    eyebrow: "Vedic timing",
    headline: "What is Vimshottari Dasha?",
    tagline:
      "The planetary clock of Jyotish — a 120-year cycle that tells you whose chapter of your chart is being read right now.",
  },
  sections: [
    {
      heading: "The 120-year planetary clock",
      paragraphs: [
        "Vimshottari dasha is the main timing system of Vedic astrology: a fixed 120-year cycle divided among nine planetary periods called mahadashas. Which period you start life in — and how much of it remains — is set by the Moon's nakshatra at your birth. Each mahadasha foregrounds one planet's themes from your chart for a span of 6 to 20 years.",
        "The name itself means 'one hundred and twenty' (vimshottari) — the idealized full human lifespan in classical texts. Nobody lives through the whole wheel from their own starting point twice; the point is not the total but the sequence, which tells an astrologer which planet currently holds the microphone.",
      ],
    },
    {
      heading: "The nine lords and their years",
      paragraphs: [
        "The cycle always runs in the same fixed order, and each lord's share of the 120 years never changes:",
      ],
      bullets: [
        "Ketu — 7 years",
        "Venus — 20 years",
        "Sun — 6 years",
        "Moon — 10 years",
        "Mars — 7 years",
        "Rahu — 18 years",
        "Jupiter — 16 years",
        "Saturn — 19 years",
        "Mercury — 17 years",
      ],
    },
    {
      heading: "How your starting point is computed",
      paragraphs: [
        "Each of the 27 nakshatras is ruled by one of these nine planets, repeating in the same Ketu-to-Mercury order three times around the zodiac. The lord of the nakshatra your Moon occupied at birth is your first mahadasha lord. How far the Moon had travelled through that nakshatra sets the balance: enter it early and you begin with most of that period remaining, enter late and the next lord takes over within a few years.",
        "This is pure arithmetic on one number — the Moon's exact sidereal longitude at birth. MyAstro360 computes it with the Swiss Ephemeris using the Lahiri (Chitrapaksha) ayanamsa, the standard reference of Indian panchangs. The calculation is deterministic: the same birth date, time, and place always produce the same dasha timeline. What varies between astrologers is interpretation, never the math.",
      ],
    },
    {
      heading: "Antardashas — periods within periods",
      paragraphs: [
        "Each mahadasha is subdivided into nine antardashas (sub-periods), one for every planet, in the same fixed order and beginning with the mahadasha lord itself. Their lengths are proportional to the mahadasha shares: an antardasha lasts the mahadasha's length multiplied by the sub-lord's years, divided by 120. So within Venus's 20-year mahadasha, the Venus antardasha runs 20 × 20 ÷ 120 — three years and four months — while the Sun antardasha lasts just one year.",
        "In practice astrologers read the mahadasha as the chapter and the antardasha as the paragraph: the sub-lord colors, moderates, or amplifies the main lord's themes. Finer subdivisions (pratyantar and beyond) exist, but the mahadasha-antardasha pair carries most of the interpretive weight.",
      ],
    },
    {
      heading: "Reading a dasha without the doom",
      paragraphs: [
        "A dasha does not import a planet's textbook reputation wholesale — it activates that planet as it actually sits in your chart. Saturn mahadasha for someone with a well-placed Saturn is classically a period of consolidation, discipline, and earned authority. Rahu's 18 years often coincide with unconventional growth, relocation, or ambition that wouldn't fit an ordinary script. The lord's house, sign, aspects, and lordships decide the flavor; the period only sets the timing.",
        "Two honest caveats. First, dasha analysis is interpretation, not fact — a lens tradition offers for reflection, not a verdict about what will happen. Second, the timeline is only as accurate as the birth time behind it: the Moon moves about a degree every two hours, and near a nakshatra boundary a small error in birth time can shift the entire sequence. If big life chapters seem offset from your computed dasha dates, an uncertain birth time is the usual suspect.",
      ],
    },
  ],
  definedTerm: {
    term: "Vimshottari Dasha",
    definition:
      "A 120-year planetary period system in Vedic astrology that assigns each of nine planets a fixed span of years, with the sequence's starting point determined by the lord of the Moon's nakshatra at birth.",
  },
  howTo: {
    heading: "How to find your current dasha",
    steps: [
      "Gather your birth date, exact birth time, and birth place, since the Moon's position depends on all three.",
      "Generate a free kundli on MyAstro360, which computes your chart with the Swiss Ephemeris and Lahiri ayanamsa.",
      "Note your janma nakshatra and its planetary lord, because that lord began your Vimshottari sequence at birth.",
      "Open the dasha table in your kundli to see the full mahadasha timeline with start and end dates.",
      "Locate today's date in the table to read off your current mahadasha and antardasha pair.",
      "Check where the current lords sit in your birth chart before drawing any conclusions about the period.",
    ],
  },
  faqs: [
    {
      q: "Should I be worried about my Saturn or Rahu mahadasha?",
      a: "No period is a sentence. Saturn and Rahu carry stern reputations, but a dasha activates the planet as it sits in your specific chart — a strong Saturn period classically brings structure, endurance, and earned respect, and Rahu periods often coincide with bold, unconventional growth. Read the lord's placement first; the years themselves are neutral timing, not a verdict.",
    },
    {
      q: "How do I know which dasha I am in right now?",
      a: "Generate your kundli with birth date, time, and place, then open the dasha table. It lists every mahadasha with start and end dates from birth onward; the row containing today's date is your current period, and its sub-table shows the running antardasha. The whole thing is computed, not estimated, so any accurate calculator will agree.",
    },
    {
      q: "Why do the nine planets get such different durations?",
      a: "The spans — from the Sun's 6 years to Venus's 20 — are fixed by classical texts, chiefly the Brihat Parashara Hora Shastra, and they always sum to 120. The tradition does not derive them from orbital periods; they are the defining convention of this particular dasha scheme, which is why every Vimshottari calculation worldwide uses the same numbers.",
    },
    {
      q: "Can two people born on the same day have different dashas?",
      a: "Yes, easily. The Moon moves roughly a degree every two hours, so people born the same day at different times can have the Moon in different nakshatras — or at different depths of the same one — giving different starting lords or different balances of the first period. This is why an exact birth time matters more for dashas than for almost anything else in the chart.",
    },
    {
      q: "Do dashas predict exactly what will happen to me?",
      a: "No. The timeline itself is deterministic arithmetic, but what a period means is interpretation — a traditional framework for reflecting on life's chapters, not a factual forecast. Treat a dasha reading as a thoughtful lens on themes and timing, and weigh it alongside your own judgment rather than in place of it.",
    },
  ],
  toolLinks: [
    {
      label: "See your dasha timeline — free kundli",
      href: "/kundli",
      blurb: "Your full Vimshottari sequence with current mahadasha and antardasha, from your birth details.",
    },
  ],
  related: ["sade-sati", "nakshatras-overview", "kundli"],
};
