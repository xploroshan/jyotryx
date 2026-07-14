/**
 * Representative render data for every template in
 * marketing/social/templates/*.html (keyed by template basename without
 * the .html extension). render.test.mjs fails loudly if a template exists
 * without a fixture here, so new templates must add one.
 *
 * Lives in helpers/ so the `node --test scripts/social/tests/*.mjs` glob
 * doesn't pick it up as a test file.
 */

export const TEMPLATE_FIXTURES = {
  'daily-sky': {
    city: 'Mumbai',
    date_label: 'Monday · 13 July 2026',
    tithi: 'Shukla Ashtami',
    nakshatra: 'Rohini',
    sunrise: '06:07 AM',
    sunset: '07:18 PM',
    rahu_kaal: '07:45–09:23',
    footnote:
      'Rahu Kaal is one-eighth of the sunrise-to-sunset arc, so it shifts with the city and the season.',
  },

  glossary: {
    term: 'nakshatra',
    term_devanagari: 'नक्षत्र',
    definition:
      'A nakshatra is one of 27 lunar mansions — equal 13°20′ segments of the sidereal zodiac that the Moon crosses at a rate of roughly one per day.',
    source_line:
      '27 equal segments of 13°20′ each, measured along the Moon’s sidereal path.',
  },

  lesson: {
    eyebrow: 'MINI-LESSON · HOUSES',
    headline: 'Your 8th house isn’t scary. It’s about depth.',
    body_html:
      '<p>The 8th house got branded the &#39;house of death&#39; and never lived it down. In practice it governs what transforms you: shared resources, inheritance, intimacy, research.</p>\n' +
      '<p>The structure explains the reputation: the 8th sits opposite your 2nd house of personal wealth.</p>',
    factor_line:
      'The 8th house is the 2nd from the 7th — your partner’s resources and everything held jointly.',
  },

  // Carousel: the 'content' (middle-slide) variant.
  'myth-bust-carousel': {
    variant: 'content',
    eyebrow: 'MYTH-BUST · MANGAL DOSHA',
    slide_no: 2,
    total: 5,
    headline: 'What it actually is',
    body_html:
      '<p>Mars in the 1st, 2nd, 4th, 7th, 8th or 12th house from your lagna. That&#39;s the entire definition — a placement, not a prophecy.</p>',
    progress_dots_html:
      '<span class="dot"></span><span class="dot dot--on"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>',
  },

  quote: {
    quote: 'A chart describes tendencies and traditions, never verdicts or physics.',
    attribution: 'MyAstro360',
  },
};
