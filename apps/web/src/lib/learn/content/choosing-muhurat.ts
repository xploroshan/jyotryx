import type { LearnArticle } from "../articles";

export const choosingMuhurat: LearnArticle = {
  slug: "choosing-muhurat",
  title: "How to Choose a Shubh Muhurat — A Practical Guide to Auspicious Timing",
  description:
    "How muhurat selection actually works: the panchang's five limbs, the windows to avoid (Rahu Kaal, Bhadra, chandra-tara checks), and how the process differs for weddings, griha pravesh and travel.",
  keywords: ["shubh muhurat", "muhurat kaise nikale", "auspicious time", "rahu kaal", "griha pravesh muhurat", "wedding muhurat"],
  datePublished: "2026-07-07",
  dateModified: "2026-07-07",
  hero: {
    eyebrow: "Muhurat",
    headline: "Choosing a muhurat, step by step",
    tagline:
      "Electional astrology is a filtering exercise: start with the calendar, remove the flawed windows, then match what remains to the person and the purpose.",
  },
  sections: [
    {
      heading: "What a muhurat is",
      paragraphs: [
        "A muhurat is a deliberately chosen moment to begin something — classically a unit of 48 minutes, practically 'the window in which we start'. The premise of muhurta shastra is that a beginning inherits the sky it starts under, so you give an important venture the best sky you reasonably can.",
        "Selection is layered: the day's panchang comes first, then subtraction of flawed windows, then person-specific checks against the native's chart, and finally purpose-specific rules that differ for a wedding versus a housewarming versus travel.",
      ],
    },
    {
      heading: "Layer 1 — the panchang's five limbs",
      paragraphs: [
        "Each of the five limbs is screened for the activity:",
      ],
      bullets: [
        "Tithi (lunar day) — rikta tithis (4th, 9th, 14th) are avoided for most beginnings; full-moon and 2nd/3rd/5th/7th/10th/11th are broadly favourable",
        "Vara (weekday) — each day carries its planet's flavour: Thursday for ceremonies and learning, Friday for love and luxury, Saturday for property and long-term stakes",
        "Nakshatra — fixed nakshatras (Rohini, Uttara-traya) for permanent things like foundations; movable ones (Swati, Punarvasu…) for travel; soft ones (Mrigashira, Chitra, Anuradha) for marriage",
        "Yoga — Vyatipata and Vaidhriti are set aside; Siddha, Amrita and similar are sought",
        "Karana — Vishti (Bhadra) karana is the classic exclusion for new undertakings",
      ],
    },
    {
      heading: "Layer 2 — subtract the flawed windows",
      paragraphs: [
        "Within a day that passes the first screen, remove the inauspicious spans: Rahu Kaal (the ~90-minute daily window whose clock time depends on the weekday and local sunrise), Gulika and Yamaganda kaal, Bhadra spans, the eclipse-adjacent days, and the sandhi (junction) minutes where tithi or nakshatra changes. This is why a muhurat is always local — the same calendar day yields different usable windows in Delhi and Chennai.",
      ],
    },
    {
      heading: "Layer 3 — match to the person and purpose",
      paragraphs: [
        "The finalists are checked against the individual's chart: the chandra-tara test (the day's nakshatra counted from your janma nakshatra should land in a favourable tara), the Moon's transit position from your rashi (3rd, 6th, 10th, 11th favoured; the 8th avoided), and — for major life events — the strength of the relevant house lord and a lagna rising at the chosen minute that is itself clean.",
        "Purpose rules then narrow further: weddings additionally screen for Venus/Jupiter combustion periods and the classical marriage nakshatras; griha pravesh favours fixed signs and nakshatras with Vastu-day compatibility; travel muhurats weigh direction (disha shool) by weekday.",
      ],
    },
    {
      heading: "A sensible modern workflow",
      paragraphs: [
        "Shortlist dates from a trustworthy panchang for your city, strike out the flawed windows, then have the chandra-tara and rashi checks done against your own birth details. MyAstro360's muhurat tool automates this pipeline — city-accurate panchang, personal chart checks — and shows why a window passed, not just that it did.",
      ],
    },
  ],
  definedTerm: {
    term: "Muhurat (Muhurta)",
    definition:
      "A deliberately chosen auspicious moment to begin an activity — classically a 48-minute unit — selected by screening the day's panchang, subtracting flawed windows such as Rahu Kaal and Bhadra, and matching what remains to the person's chart and the purpose.",
  },
  howTo: {
    heading: "How to choose a shubh muhurat",
    steps: [
      "Shortlist candidate dates from a trustworthy panchang computed for the city where the event will actually happen — sunrise-dependent windows differ by location.",
      "Screen the five limbs for the activity: favourable tithi and vara, a nakshatra suited to the purpose, and no Vyatipata or Vaidhriti yoga or Vishti (Bhadra) karana.",
      "Subtract the flawed windows within each surviving day: Rahu Kaal, Gulika and Yamaganda kaal, Bhadra spans, eclipse-adjacent days, and the sandhi minutes where tithi or nakshatra changes.",
      "Check the finalists against your own chart: the chandra-tara count from your janma nakshatra, and the Moon's transit position from your rashi (3rd, 6th, 10th, 11th favoured).",
      "Apply the purpose-specific rules — marriage nakshatras and Venus/Jupiter combustion checks for weddings, fixed signs for griha pravesh, disha shool by weekday for travel.",
      "Fix the final minute so a clean lagna rises; if the ideal window is impractical, keep the nakshatra and tithi clean and protect the lagna.",
    ],
  },
  faqs: [
    {
      q: "What is Rahu Kaal and does it change daily?",
      a: "A roughly 90-minute daily window ruled by Rahu, avoided for starting new work. Its slot depends on the weekday (e.g. Monday morning, Saturday early morning) and is computed from local sunrise/sunset — so it shifts by city and by season.",
    },
    {
      q: "Can a muhurat be found for any date?",
      a: "Not always a good one. Some dates fail at the panchang layer for a given purpose (rikta tithi + Bhadra + malefic yoga can consume a day). Flexibility of even ±3 days dramatically improves the quality of available windows.",
    },
    {
      q: "Is the same muhurat valid in every city?",
      a: "No. Sunrise-dependent windows (Rahu Kaal, Gulika), the rising lagna, and even the tithi's span differ by location. Always compute for the city where the event happens.",
    },
    {
      q: "What if the ideal muhurat is impractical?",
      a: "Muhurta shastra itself ranks compromises: keep the nakshatra and tithi clean, protect the lagna, and accept a weaker vara if needed. The goal is the best feasible sky, not a perfect one — and the abhijit muhurat (midday) serves as a general-purpose fallback for many activities.",
    },
  ],
  toolLinks: [
    {
      label: "Find your muhurat",
      href: "/muhurat",
      blurb: "Purpose-specific auspicious windows, checked against your chart.",
    },
    {
      label: "Today's panchang",
      href: "/panchang",
      blurb: "Tithi, nakshatra, yoga, karana and Rahu Kaal for your city.",
    },
  ],
  related: ["nakshatras-overview", "rashi-vs-sun-sign", "rahu-kaal", "panchang-explained"],
};
