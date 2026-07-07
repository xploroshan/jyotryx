import type { LearnArticle } from "../articles";

export const rashiVsSunSign: LearnArticle = {
  slug: "rashi-vs-sun-sign",
  title: "Rashi vs Sun Sign — Why Your Vedic Sign Differs from Your Horoscope Sign",
  description:
    "Moon sign (rashi) vs Western sun sign: why Vedic astrology reads the Moon first, what the ~24° ayanamsa shift means, and which sign you should read your daily horoscope for.",
  keywords: ["rashi", "moon sign", "sun sign vs moon sign", "vedic sign", "ayanamsa", "sidereal vs tropical"],
  datePublished: "2026-07-07",
  dateModified: "2026-07-07",
  hero: {
    eyebrow: "Vedic foundations",
    headline: "Rashi vs sun sign: which one is 'your' sign?",
    tagline:
      "Two systems, two skies, two answers — and both are internally consistent once you know what each measures.",
  },
  sections: [
    {
      heading: "Two different questions",
      paragraphs: [
        "'What's your sign?' hides two questions. Western popular astrology asks where the SUN was on your birthday, measured against the tropical zodiac. Jyotish asks where the MOON was at your birth moment, measured against the sidereal zodiac. Different luminary, different reference frame — so the answers often differ, and neither is a mistake.",
        "Your rashi (janma rashi / chandra rashi) is the sign the Moon occupied at birth. In Vedic practice it — not the sun sign — anchors daily predictions, dasha interpretation, matching, and the nakshatra system layered beneath it.",
      ],
    },
    {
      heading: "The ayanamsa: why the zodiacs disagree",
      paragraphs: [
        "The tropical zodiac fixes 0° Aries to the spring equinox; the sidereal zodiac fixes it near the actual stars of Aries. Because Earth's axis precesses, the equinox drifts backwards through the constellations about 1° every 72 years. The accumulated gap — the ayanamsa — is currently about 24°, using the Lahiri value standard in India.",
        "Practical effect: someone born a 'Taurus sun' in the Western system frequently has a sidereal Sun in Aries, because subtracting ~24° often crosses a sign boundary. The same shift applies to every planet, which is why a Vedic chart can look one sign 'earlier' than a Western one.",
      ],
    },
    {
      heading: "Why Jyotish privileges the Moon",
      paragraphs: [
        "The Moon in Jyotish is manas — the mind, moods, and instinctive responses; the classical texts read general life experience from the Moon as an alternate ascendant (Chandra lagna). It also changes sign every ~2.25 days, making it personal in a way a month-long sun sign cannot be, and it selects your nakshatra, which starts your Vimshottari dasha clock.",
        "The Sun still matters in Vedic astrology — soul, vitality, father, authority — it simply isn't the default lens for daily life the way popular Western columns use it.",
      ],
    },
    {
      heading: "So which horoscope should you read?",
      paragraphs: [
        "For Vedic daily/weekly forecasts (including MyAstro360's), read your MOON sign — that's what the predictions are computed against. If you don't know it, any free kundli reveals it in seconds from your birth date, time and place; without a birth time it can still be determined on most dates, since the Moon holds a sign for over two days.",
        "Reading both your rashi and your Western sun sign is fine — just know they answer different questions, and don't be surprised when they diverge: with a ~24° offset, roughly two people in three have a sidereal Sun one sign behind their tropical one.",
      ],
    },
  ],
  faqs: [
    {
      q: "My Western sign is Leo but my rashi says Cancer. Which is correct?",
      a: "Both, within their own systems. The Western Leo is your tropical SUN sign; the Cancer rashi is your sidereal MOON sign. They measure different bodies against different zodiacs — there's no contradiction to resolve.",
    },
    {
      q: "What is the Lahiri ayanamsa?",
      a: "The official sidereal offset adopted by India's Calendar Reform Committee, anchored to the star Spica (Chitra) at 0° Libra. It's the default in Indian panchangs and in MyAstro360's calculations — currently a shade over 24°.",
    },
    {
      q: "Can my rashi and sun sign be the same sign?",
      a: "Certainly — the Moon spends ~2.25 days in each sign, so on some birthdays it shares the Sun's sidereal sign. It's the luminaries and zodiacs that differ conceptually; coincidence of the labels happens regularly.",
    },
    {
      q: "Do I need a birth time to know my rashi?",
      a: "Usually not — the Moon holds one sign for over two days. But near a sign change (or for the nakshatra pada, ascendant, and houses) the exact time matters.",
    },
  ],
  toolLinks: [
    {
      label: "Find your rashi — free kundli",
      href: "/kundli",
      blurb: "Moon sign, nakshatra, lagna and full chart from your birth details.",
    },
    {
      label: "Read today's horoscope",
      href: "/horoscope",
      blurb: "Daily, weekly, monthly and yearly forecasts for all 12 signs.",
    },
  ],
  related: ["nakshatras-overview", "navamsa-d9"],
};
