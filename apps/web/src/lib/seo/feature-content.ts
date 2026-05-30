/**
 * Long-form, server-rendered SEO content for the Tier-A FEATURE pages
 * (/numerology, /tarot, …). These pages are otherwise just an interactive
 * client widget with almost no crawlable text — a thin-content signal on the
 * exact URLs targeting our highest-value head terms. This module gives each
 * one a real explainer + "how it works" + FAQ, rendered as HTML on the server
 * (see components/seo/FeatureSeoSection) plus FAQPage structured data.
 *
 * Content is original and product-accurate (no boilerplate, no keyword
 * stuffing) — Google rewards depth and uniqueness, and the FAQ can win rich
 * results for India/astrology queries.
 *
 * English lives here; localized copy is keyed by locale in the dictionary so
 * the `/<locale>` variants render translated content (never mixed-language)
 * and fall back to NO section when a translation is absent.
 */
export interface FeatureFaq {
  q: string;
  a: string;
}

export interface FeatureContent {
  /** H2 above the explainer, e.g. "About Numerology". */
  heading: string;
  /** 1–3 short paragraphs explaining what it is and why it's useful. */
  intro: string[];
  howItWorks: {
    heading: string;
    steps: string[];
  };
  faqHeading: string;
  faqs: FeatureFaq[];
}

export const FEATURE_CONTENT: Record<string, FeatureContent> = {
  '/numerology': {
    heading: 'About numerology',
    intro: [
      'Numerology reads the numbers behind your name and date of birth to describe your strengths, life direction and the patterns that recur in your decisions. In the Vedic tradition each number is tied to a planet — for example 1 to the Sun and 3 to Jupiter — so a numerology profile is really a compact planetary signature.',
      "myastro360's calculator derives your core numbers — life path, destiny (expression), soul (heart's desire) and personality — and explains each in plain language, with the lucky colours, days and compatible numbers that follow from them. It also scores a brand or business name so you can choose one that's vibrationally aligned.",
    ],
    howItWorks: {
      heading: 'How the numerology calculator works',
      steps: [
        'Enter your full birth name and date of birth, or a brand/business name to analyse.',
        'We reduce the letters and digits using the Chaldean and Pythagorean systems to your core numbers.',
        'Each number is mapped to its ruling planet and interpreted for strengths, cautions and timing.',
        'You get a shareable profile with lucky colours, favourable days and compatibility at a glance.',
      ],
    },
    faqHeading: 'Numerology — frequently asked questions',
    faqs: [
      { q: 'Is the numerology calculator free?', a: 'Yes — the core name and birth-number analysis is free for every signed-up user, with no credits spent on the first reading.' },
      { q: 'What is a life path number?', a: 'Your life path number is the single digit (or master number) reduced from your full date of birth. It describes your overall direction, natural talents and the kind of lessons that recur across your life.' },
      { q: 'Which numerology system do you use?', a: 'We compute both Chaldean (used in Vedic/Indian numerology, where letters map to sounds and planets) and Pythagorean (the Western 1–9 letter map), so you can see name numbers in the system you trust.' },
      { q: 'Can numerology suggest a good business or brand name?', a: 'Yes. The brand analyser scores a proposed name, tells you the ruling number and planet, and flags whether it is favourable, neutral or needs adjustment for your line of work.' },
      { q: 'Do I need my exact birth time for numerology?', a: 'No — numerology uses only your name and date of birth, not the time. (Birth time is needed for a kundli/birth chart, which is a separate tool.)' },
    ],
  },

  '/tarot': {
    heading: 'About tarot reading',
    intro: [
      'A tarot reading uses the 78-card deck — 22 Major Arcana that mark life’s big themes and 56 Minor Arcana that cover everyday matters — to reflect a situation back to you and surface the choice in front of you. It is a tool for clarity and perspective, not fixed prophecy.',
      'myastro360 draws your cards and explains each one in context: its upright or reversed meaning, how it speaks to love, career or a specific question, and what the spread suggests as a next step.',
    ],
    howItWorks: {
      heading: 'How an online tarot reading works',
      steps: [
        'Hold your question in mind — love, career, a decision, or an open "what should I focus on?"',
        'Shuffle and draw; the cards are dealt from the full 78-card deck with no repeats in a spread.',
        'Each card is interpreted for position and orientation (upright/reversed) against your question.',
        'You get a clear reading plus a suggested focus — guidance you can act on, privately.',
      ],
    },
    faqHeading: 'Tarot — frequently asked questions',
    faqs: [
      { q: 'Is the online tarot reading free?', a: 'Yes — you can pull a free reading for love, career or a general question. It is instant and private.' },
      { q: 'Are reversed cards included?', a: 'Yes. Cards can appear upright or reversed, and the reading interprets the orientation — reversals often soften, block or internalise the upright meaning.' },
      { q: 'Can tarot predict the future?', a: 'Tarot is best understood as a mirror for the present: it clarifies the forces at play and the likely direction if nothing changes, so you can make a better choice. It is guidance, not a fixed forecast.' },
      { q: 'What can I ask the cards?', a: 'Open, reflective questions work best — "What do I need to know about this relationship?" rather than "Will I marry in March?". The reading then gives you something to act on.' },
      { q: 'Is my reading private?', a: 'Yes. Readings are generated for you and are not shared; you can return to draw again any time.' },
    ],
  },

  '/vastu': {
    heading: 'About Vastu Shastra',
    intro: [
      'Vastu Shastra is the traditional Indian science of architecture and placement. It aligns the design of a home or workplace with the five elements (earth, water, fire, air, space) and the cardinal directions so that light, air and energy flow in a way that supports health, focus and prosperity.',
      'myastro360 turns Vastu into practical, room-by-room guidance — where to place the kitchen, the bed, the cash box or a study — and the simple remedies that correct a less-than-ideal layout without rebuilding.',
    ],
    howItWorks: {
      heading: 'How Vastu guidance works',
      steps: [
        'Tell us the space — home, room or office — and the direction it faces.',
        'We map the ideal placement of each function to its Vastu direction and element.',
        'Where the existing layout differs, we suggest practical remedies (mirrors, colours, plants, repositioning).',
        'You get a clear checklist you can apply without structural changes.',
      ],
    },
    faqHeading: 'Vastu — frequently asked questions',
    faqs: [
      { q: 'Which direction should the main entrance face?', a: 'North, east and north-east facing entrances are considered most auspicious because they draw in morning light and positive energy, but every direction has remedies — the right entrance depends on the whole plot.' },
      { q: 'Where should the kitchen be as per Vastu?', a: 'The south-east is the ideal zone for the kitchen (the fire element), with the cook facing east while preparing food. The north-east and south-west should be avoided for the stove.' },
      { q: 'Can I fix Vastu defects without breaking walls?', a: 'In most cases, yes. Colours, mirrors, lighting, plants, salt remedies and repositioning furniture correct the majority of common Vastu issues without any construction.' },
      { q: 'Which direction should I sleep facing?', a: 'Sleep with your head towards the south (or east) and feet towards the north. Head-to-north is traditionally discouraged as it can disturb rest.' },
      { q: 'Does Vastu apply to offices and shops?', a: 'Yes — the owner or cash box in the south-west, staff facing north or east, and a clutter-free north-east are common workplace recommendations for stability and growth.' },
    ],
  },

  '/muhurat': {
    heading: 'About shubh muhurat',
    intro: [
      'A muhurat is an auspicious window of time chosen so that an important event begins under supportive planetary conditions. Indian tradition uses the panchang — tithi, nakshatra, yoga, karana and weekday — together with the placement of the Moon and benefic planets to find when to start a marriage, a house-warming (griha pravesh), a new business, or travel.',
      'myastro360 finds favourable muhurat windows for your event and location, and flags the inauspicious periods (rahu kaal, yamaganda, gulika) to avoid.',
    ],
    howItWorks: {
      heading: 'How muhurat selection works',
      steps: [
        'Choose the event — marriage, griha pravesh, naming, vehicle or business start, travel.',
        'We read the day’s panchang for your city and date range.',
        'Favourable tithi/nakshatra/yoga combinations are matched to your event type.',
        'You get the recommended windows, with inauspicious periods clearly marked to avoid.',
      ],
    },
    faqHeading: 'Muhurat — frequently asked questions',
    faqs: [
      { q: 'What is a shubh muhurat?', a: 'A shubh muhurat is an auspicious time window in which to begin an important activity, chosen from the panchang so the start aligns with supportive planetary and lunar conditions.' },
      { q: 'Why does muhurat depend on my city?', a: 'Sunrise, sunset and the exact timing of tithi and nakshatra shift with longitude and latitude, and inauspicious periods like rahu kaal are calculated from local sunrise — so the right window is location-specific.' },
      { q: 'What is rahu kaal and should I avoid it?', a: 'Rahu kaal is an inauspicious ~90-minute period each day, calculated from sunrise. New or important activities are traditionally not begun during it; routine work is fine.' },
      { q: 'Can you find a marriage muhurat?', a: 'Yes — marriage (vivah) muhurat is one of the core event types, matched to favourable tithi, nakshatra and the avoidance of periods like chaturmas where applicable.' },
      { q: 'How far ahead can I plan a muhurat?', a: 'You can look across upcoming days and weeks to compare windows, which is useful for scheduling events that need advance planning.' },
    ],
  },

  '/palmistry': {
    heading: 'About palmistry',
    intro: [
      'Palmistry (hast rekha) reads the lines, mounts and shape of the hand to describe temperament, strengths and the broad arc of life. The four major lines — heart, head, life and fate — and the mounts named for the planets each carry meaning that, read together, form a personality portrait.',
      'myastro360 analyses a photo of your palm and explains what each line and mount suggests, in clear language, with no jargon and nothing left vague.',
    ],
    howItWorks: {
      heading: 'How AI palm reading works',
      steps: [
        'Upload a clear, well-lit photo of your dominant palm.',
        'We identify the major lines (heart, head, life, fate) and the planetary mounts.',
        'Each feature is interpreted for personality, relationships, career and vitality.',
        'You receive a readable summary you can revisit any time.',
      ],
    },
    faqHeading: 'Palmistry — frequently asked questions',
    faqs: [
      { q: 'Is the palm reading free?', a: 'Yes — you can upload a palm photo and get a free AI-assisted reading of your major lines and mounts.' },
      { q: 'Which hand should I photograph?', a: 'Use your dominant hand (the one you write with) for your active, present life. The non-dominant hand is read for inherited traits and potential; many readers compare both.' },
      { q: 'How do I take a good palm photo?', a: 'Photograph your open palm in bright, even light, fingers slightly spread, with the lines clearly visible and no glare or shadow. A plain background helps.' },
      { q: 'What do the four major lines mean?', a: 'The heart line covers emotions and relationships, the head line thinking and decisions, the life line vitality and life changes, and the fate line career and the influence of circumstances.' },
      { q: 'Is my palm photo kept private?', a: 'Your reading is generated for you privately and is not shared publicly.' },
    ],
  },

  '/matching': {
    heading: 'About kundli matching',
    intro: [
      'Kundli matching (Guna Milan) is the Vedic method of checking marriage compatibility by comparing the birth charts of two people. The Ashtakoota system scores eight factors — from Varna and Vashya to Nadi — out of 36 points, and also checks for Mangal (Manglik) dosha, to gauge mental, physical and spiritual compatibility.',
      'myastro360 computes the full 36-guna score, explains what each koota means for the couple, runs the Manglik check, and gives a clear, balanced read rather than a simple pass/fail.',
    ],
    howItWorks: {
      heading: 'How kundli matching works',
      steps: [
        'Enter the birth details (date, time, place) for both partners.',
        'We compute each chart with Swiss Ephemeris and Lahiri ayanamsa.',
        'The eight kootas are scored to a 36-point Guna Milan total, with Mangal dosha checked.',
        'You get the score, a koota-by-koota explanation, and remedies where relevant.',
      ],
    },
    faqHeading: 'Kundli matching — frequently asked questions',
    faqs: [
      { q: 'What is a good Guna Milan score?', a: 'Out of 36 gunas, 18 and above is traditionally considered acceptable, 24–32 is very good, and below 18 warrants closer review. The score is a guide, not the whole picture — individual kootas and dosha matter too.' },
      { q: 'What is Nadi dosha?', a: 'Nadi is the highest-weighted koota (8 points), tied to health and progeny. A Nadi dosha (both partners in the same Nadi) is taken seriously, though certain combinations are considered cancelled (Nadi dosha bhanga).' },
      { q: 'What is Manglik (Mangal) dosha?', a: 'Manglik dosha occurs when Mars sits in certain houses of the chart. When one partner is Manglik, matching checks whether the other is too, or whether the dosha is cancelled, before drawing conclusions.' },
      { q: 'Do I need exact birth times for both people?', a: 'Accurate birth time and place for both partners give the most reliable match, because the Moon’s nakshatra and the ascendant depend on them.' },
      { q: 'Is low compatibility final?', a: 'No. A low score highlights areas to understand and, where tradition allows, remedies. Many couples with lower scores are well matched on the factors that matter to them.' },
    ],
  },

  '/kundli': {
    heading: 'About your kundli (birth chart)',
    intro: [
      'A kundli (janam kundali) is your Vedic birth chart — a snapshot of the sky at the exact moment and place you were born. It maps the planets across twelve houses and the sidereal zodiac, and from it flow your dashas (planetary periods), yogas, doshas and the timing of life events.',
      'myastro360 generates a complete kundli from Swiss Ephemeris with Lahiri ayanamsa — the rasi and navamsa charts, Vimshottari dasha, planetary positions and dosha checks — and explains it in language you can actually use.',
    ],
    howItWorks: {
      heading: 'How the kundli generator works',
      steps: [
        'Enter your date, exact time and place of birth.',
        'We compute planetary positions with Swiss Ephemeris and Lahiri (sidereal) ayanamsa.',
        'Your charts (D-1, D-9), dasha periods, yogas and doshas are derived.',
        'You get a readable chart you can return to any time, free for your first kundli.',
      ],
    },
    faqHeading: 'Kundli — frequently asked questions',
    faqs: [
      { q: 'Is the kundli free?', a: 'Yes — your first Vedic kundli is free for every signed-up user, and you can view it again any time without re-entering your details.' },
      { q: 'Why is exact birth time important for a kundli?', a: 'The ascendant (lagna) and the house cusps move roughly one degree every four minutes, so an accurate birth time is what places your planets in the right houses. Even a few minutes can shift the lagna.' },
      { q: 'Which ayanamsa do you use?', a: 'Lahiri ayanamsa — the sidereal zero point used by standard Indian panchang and recognised by the government’s Calendar Reform Committee — applied consistently across chart, dasha and transits.' },
      { q: 'What does the kundli include?', a: 'The rasi (D-1) and navamsa (D-9) charts, Vimshottari dasha with sub-periods, planetary positions by sign, degree and nakshatra, house lordships, key yogas, and dosha checks (Manglik, Kaal Sarp, Nadi, Pitra).' },
      { q: 'How accurate is the chart?', a: 'Charts come from Swiss Ephemeris, the same astronomical engine used by professional astrologers; the same inputs always return the same chart — nothing is randomised.' },
    ],
  },
};
