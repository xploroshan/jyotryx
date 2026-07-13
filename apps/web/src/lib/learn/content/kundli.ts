import type { LearnArticle } from "../articles";

export const kundliGuide: LearnArticle = {
  slug: "kundli",
  title: "What Is a Kundli? The Vedic Birth Chart, Explained",
  description:
    "What a kundli (janam kundli) is, what its 12 houses, 9 grahas and lagna encode, how it's computed with Swiss Ephemeris and Lahiri ayanamsa, and how to read one.",
  keywords: [
    "kundli",
    "janam kundli",
    "vedic birth chart",
    "kundli online",
    "lagna",
    "12 houses",
    "9 grahas",
    "birth chart astrology",
  ],
  datePublished: "2026-07-13",
  dateModified: "2026-07-13",
  hero: {
    eyebrow: "Vedic foundations",
    headline: "What is a kundli (janam kundli / Vedic birth chart)?",
    tagline:
      "One map of the sky at the moment you were born — the starting point for everything else in Jyotish.",
  },
  sections: [
    {
      heading: "The short answer",
      paragraphs: [
        "A kundli (janam kundli) is a Vedic birth chart: a map of the sky at the exact moment and place of your birth. It records the sidereal positions of the nine grahas across the twelve zodiac signs, arranged into twelve houses counted from your lagna, the sign rising on the eastern horizon.",
        "That single snapshot is the foundation of Jyotish. Every other technique — dashas, transits, the navamsa, kundli matching — starts by reading this one chart. Two births at the same minute in different cities produce different kundlis, because the rising sign depends on where on Earth you stood.",
      ],
    },
    {
      heading: "What the chart encodes: lagna, houses, and grahas",
      paragraphs: [
        "A kundli has three interlocking layers. The lagna (ascendant) is the zodiac sign crossing the eastern horizon at your birth moment; it changes roughly every two hours, which is why birth time matters so much. The lagna fixes the first house, and the remaining eleven houses follow in zodiac order.",
        "The twelve houses (bhavas) are the areas of life the chart speaks about, and the nine grahas — Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, plus the lunar nodes Rahu and Ketu — are the actors placed within them. Reading a kundli is essentially asking: which graha sits in or rules which house, and in which sign?",
      ],
      bullets: [
        "Houses 1–4: self and body, wealth and speech, siblings and courage, home and mother",
        "Houses 5–8: children and creativity, health and service, partnership and marriage, longevity and transformation",
        "Houses 9–12: fortune and dharma, career and status, gains and friendships, loss and liberation",
        "Each graha carries classical significations — the Moon for the mind, Jupiter for wisdom and children, Saturn for discipline and delay, and so on",
      ],
    },
    {
      heading: "How MyAstro360 computes your kundli",
      paragraphs: [
        "A kundli is astronomy first, interpretation second. MyAstro360 computes planetary positions with the Swiss Ephemeris, the same high-precision astronomical library professional software relies on, and converts them to the sidereal zodiac using the Lahiri (Chitrapaksha) ayanamsa — the reference standard used by Indian panchangs and the Indian government's calendar committee.",
        "The ayanamsa is the correction that separates Vedic charts from Western ones: it subtracts the accumulated drift between the tropical zodiac (tied to the seasons) and the sidereal zodiac (tied to the fixed stars), currently a little over 24 degrees. The whole calculation is deterministic — the same date, time, and place always produce exactly the same chart, on our site or anyone else's using the same standards.",
        "This is worth stressing because chart errors are the most common source of bad readings. If two apps show you different kundlis, they are almost always using different ayanamsas or an imprecise birth time — not different astrology.",
      ],
    },
    {
      heading: "Reading your kundli in practice",
      paragraphs: [
        "Start simple. Identify your lagna and its lord — the graha that rules your rising sign — and see where that lord sits; classical texts treat this as the chart's central thread. Then look at the Moon: its sign is your rashi and its nakshatra starts your Vimshottari dasha timeline. Only after that does it make sense to examine individual houses for specific questions.",
        "Resist the urge to judge any single placement in isolation. A graha's meaning shifts with its sign, house, aspects, and the dasha currently running. A well-read kundli is a weighing of the whole pattern, which is why experienced astrologers spend most of their time cross-checking factors rather than reciting one-line rules.",
      ],
    },
    {
      heading: "What a kundli can and cannot tell you",
      paragraphs: [
        "Be clear-eyed about what this is. The astronomy in a kundli is fact: the planets really were where the chart says they were. The meanings assigned to those positions are interpretation — a classical framework for reflection, refined over centuries but not a scientific prediction of your life. Two skilled astrologers can read the same chart differently.",
        "Used honestly, a kundli is a structured mirror: a vocabulary for thinking about temperament, timing, and life themes. It does not fix your fate, and no placement in it is a verdict. Every claim a good reading makes should trace back to a specific, nameable chart factor you can verify yourself.",
      ],
    },
  ],
  definedTerm: {
    term: "Kundli (Janam Kundli)",
    definition:
      "A Vedic birth chart: a diagram of the sidereal positions of the nine grahas across the twelve houses, counted from the lagna (ascendant) rising at the exact time and place of a person's birth.",
  },
  howTo: {
    heading: "How to generate and read your kundli",
    steps: [
      "Gather your birth date, exact birth time, and birth place — the lagna changes about every two hours, so precision matters.",
      "Enter these details into the free kundli tool, which computes sidereal positions with the Swiss Ephemeris and Lahiri ayanamsa.",
      "Find your lagna in the first house and note which sign and graha rule it.",
      "Locate the Moon to learn your rashi and janma nakshatra, which set your dasha timeline.",
      "Scan the twelve houses to see which grahas occupy the life areas you are curious about.",
      "Read placements together rather than in isolation, weighing sign, house, aspects, and the running dasha.",
    ],
  },
  faqs: [
    {
      q: "What details do I need to make a kundli?",
      a: "Three things: birth date, birth time, and birth place. Date and place are usually easy; time is the sensitive one, because the lagna shifts sign roughly every two hours and the Moon moves about a degree every two hours. A birth certificate or hospital record is the most reliable source. If your time is approximate, the planetary signs are usually still correct, but house placements may shift.",
    },
    {
      q: "Is a kundli the same as a Western birth chart?",
      a: "Same idea, different zodiac. Both map the sky at birth, but a kundli uses the sidereal zodiac, aligned to the fixed stars via an ayanamsa, while Western charts use the tropical zodiac, aligned to the seasons. The two currently differ by a little over 24 degrees, so most people's Sun and other placements land one sign earlier in their kundli.",
    },
    {
      q: "My kundli shows a difficult placement — should I be worried?",
      a: "No single placement decides anything, and a kundli is interpretation, not verdict. Classical astrology always weighs a factor against the whole chart: sign, house, aspects, the lagna lord's condition, and the current dasha. Placements traditionally labelled difficult often also indicate discipline, depth, or resilience. If a reading frightens you without explaining the full pattern, that says more about the reader than your chart.",
    },
    {
      q: "Why do different apps show me different kundlis?",
      a: "Almost always one of two reasons: a different ayanamsa or a different birth time. Apps using Raman or KP ayanamsas will place planets slightly differently than Lahiri, and near a sign boundary that shifts a placement entirely. MyAstro360 uses the Swiss Ephemeris with the Lahiri ayanamsa — the mainstream Indian standard — so the same inputs always reproduce the same chart.",
    },
    {
      q: "Can I read my own kundli without an astrologer?",
      a: "Yes, and it is a good way to learn. Start with the lagna, its lord, and the Moon's sign and nakshatra — that alone covers much of what a first reading discusses. Free tools compute everything for you, so your effort goes into understanding placements, not calculating them. An experienced astrologer adds judgement in weighing conflicting factors, but the chart itself is fully yours to explore.",
    },
  ],
  toolLinks: [
    {
      label: "Generate your free kundli",
      href: "/kundli",
      blurb: "Your full Vedic birth chart from birth date, time, and place — in seconds.",
    },
  ],
  related: ["kundli-matching", "vimshottari-dasha", "nakshatras-overview"],
};
