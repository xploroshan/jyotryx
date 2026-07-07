import type { LearnArticle } from "../articles";

export const nakshatrasOverview: LearnArticle = {
  slug: "nakshatras-overview",
  title: "The 27 Nakshatras — Lunar Mansions in Vedic Astrology, Explained",
  description:
    "What nakshatras are, how the Moon's 27 lunar mansions divide the zodiac, why your janma nakshatra matters more than your sun sign in Jyotish, and how it sets your Vimshottari dasha.",
  keywords: ["nakshatra", "27 nakshatras", "janma nakshatra", "birth star", "lunar mansions"],
  datePublished: "2026-07-07",
  dateModified: "2026-07-07",
  hero: {
    eyebrow: "Vedic foundations",
    headline: "The 27 Nakshatras, explained",
    tagline:
      "The Moon's lunar mansions are the oldest layer of Indian astrology — and the key that unlocks your dasha timeline.",
  },
  sections: [
    {
      heading: "What is a nakshatra?",
      paragraphs: [
        "A nakshatra is one of 27 equal divisions of the zodiac, each spanning 13°20′ of the ecliptic. Where the twelve rashis (signs) divide the sky by the Sun's yearly path, the nakshatras follow the Moon: it passes through roughly one nakshatra per day, completing the full circle in a sidereal month of about 27.3 days.",
        "The system is older than sign-based astrology in India — nakshatras appear in the Vedas as the bride-stars of the Moon, and classical texts assign each one a ruling deity, a planetary lord, a symbol, and a temperament. When Indian astrologers speak of your 'birth star' (janma nakshatra), they mean the nakshatra the Moon occupied at the moment you were born.",
      ],
    },
    {
      heading: "Why your janma nakshatra matters",
      paragraphs: [
        "In Jyotish, the Moon represents the mind (manas) — your instinctive emotional wiring. Because the Moon moves so fast, the nakshatra is a far more personal marker than the sun sign shared by everyone born in the same month. Two people with the same rashi can have very different temperaments if their Moons sit in different nakshatras.",
        "Your janma nakshatra also decides three practical things: the starting point of your Vimshottari dasha sequence (see below), your name syllables in traditional naming ceremonies, and several of the compatibility kootas used in kundli matching — including the Nadi koota, the heaviest-weighted of the 36 gunas.",
      ],
    },
    {
      heading: "Nakshatras and the Vimshottari dasha",
      paragraphs: [
        "Each nakshatra is ruled by one of nine planets in a fixed repeating order: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury. The lord of your janma nakshatra starts your Vimshottari dasha — the 120-year planetary period cycle Vedic astrologers use for timing.",
        "How far the Moon had travelled through the nakshatra at birth sets how much of that first period remains. Born with the Moon early in Pushya (ruled by Saturn), you begin with most of a 19-year Saturn mahadasha; born near its end, Saturn is nearly spent and Mercury's 17 years begin soon. This is why an accurate birth time matters — it fixes the Moon's exact degree.",
      ],
    },
    {
      heading: "The 27 nakshatras at a glance",
      paragraphs: [
        "Each nakshatra spans 13°20′ and is divided into four padas (quarters) of 3°20′ that map into the navamsa chart. The sequence runs:",
      ],
      bullets: [
        "Ashwini, Bharani, Krittika (Aries–Taurus) — beginnings, bearing, burning purification",
        "Rohini, Mrigashira, Ardra (Taurus–Gemini) — growth, seeking, the storm",
        "Punarvasu, Pushya, Ashlesha (Gemini–Cancer) — return of light, nourishment, the serpent's embrace",
        "Magha, Purva Phalguni, Uttara Phalguni (Leo–Virgo) — ancestry, pleasure, patronage",
        "Hasta, Chitra, Swati (Virgo–Libra) — the craftsman's hand, the jewel, the free wind",
        "Vishakha, Anuradha, Jyeshtha (Libra–Scorpio) — determined ambition, devoted friendship, seniority",
        "Mula, Purva Ashadha, Uttara Ashadha (Sagittarius) — the root, early victory, final victory",
        "Shravana, Dhanishta, Shatabhisha (Capricorn–Aquarius) — listening, wealth-rhythm, the hundred healers",
        "Purva Bhadrapada, Uttara Bhadrapada, Revati (Aquarius–Pisces) — intensity, depth, the safe crossing",
      ],
    },
    {
      heading: "Finding yours",
      paragraphs: [
        "You need your birth date, time, and place — the Moon moves about a degree every two hours, so time matters. Any kundli generated on MyAstro360 computes your janma nakshatra (and every planet's nakshatra) from Swiss Ephemeris with the Lahiri ayanamsa, the standard sidereal reference used by Indian panchangs.",
      ],
    },
  ],
  faqs: [
    {
      q: "What is my nakshatra if I only know my date of birth?",
      a: "Usually determinable, but not always: the Moon changes nakshatra roughly daily, so on many dates it occupies one nakshatra at midnight and the next by evening. With a birth time you get certainty — and the exact pada, which the navamsa and dasha balance depend on.",
    },
    {
      q: "Is the nakshatra the same as the moon sign (rashi)?",
      a: "No. The rashi is the 30° sign the Moon occupies; the nakshatra is the finer 13°20′ mansion. Each rashi contains two-and-a-quarter nakshatras, so your nakshatra always implies your rashi but not the other way round.",
    },
    {
      q: "Which nakshatras are considered gandanta?",
      a: "The junctions between water and fire signs — Ashlesha→Magha, Jyeshtha→Mula, and Revati→Ashwini — are gandanta zones. Births in these narrow bands are traditionally given extra care in interpretation and sometimes specific remedies.",
    },
    {
      q: "Do nakshatras affect kundli matching?",
      a: "Directly: several of the Ashtakoota gunas — including Nadi (8 points) and Gana — are computed purely from the two janma nakshatras. That's why matching requires both birth details, not just sun signs.",
    },
  ],
  toolLinks: [
    {
      label: "Find your nakshatra — free kundli",
      href: "/kundli",
      blurb: "Your janma nakshatra, pada, rashi and full chart from your birth details.",
    },
    {
      label: "See your dasha timeline",
      href: "/vedic/dasha",
      blurb: "The Vimshottari sequence your nakshatra starts, with current periods.",
    },
  ],
  related: ["rashi-vs-sun-sign", "navamsa-d9"],
};
