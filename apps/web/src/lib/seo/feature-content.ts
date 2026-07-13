import type { Locale } from '@/i18n/locales';
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
 * English lives in FEATURE_CONTENT; localized copy lives in
 * FEATURE_CONTENT_LOCALE keyed by locale code, then path. Use
 * getFeatureContent(locale, path) to resolve — it falls back to undefined
 * (not to English) so a localized page never shows English-only copy.
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
      "MyAstro360's calculator derives your core numbers — life path, destiny (expression), soul (heart's desire) and personality — and explains each in plain language, with the lucky colours, days and compatible numbers that follow from them. It also scores a brand or business name so you can choose one that's vibrationally aligned.",
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
      'MyAstro360 draws your cards and explains each one in context: its upright or reversed meaning, how it speaks to love, career or a specific question, and what the spread suggests as a next step.',
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
      'MyAstro360 turns Vastu into practical, room-by-room guidance — where to place the kitchen, the bed, the cash box or a study — and the simple remedies that correct a less-than-ideal layout without rebuilding.',
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
      'MyAstro360 finds favourable muhurat windows for your event and location, and flags the inauspicious periods (rahu kaal, yamaganda, gulika) to avoid.',
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
      'MyAstro360 analyses a photo of your palm and explains what each line and mount suggests, in clear language, with no jargon and nothing left vague.',
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
      'MyAstro360 computes the full 36-guna score, explains what each koota means for the couple, runs the Manglik check, and gives a clear, balanced read rather than a simple pass/fail.',
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
      'MyAstro360 generates a complete kundli from Swiss Ephemeris with Lahiri ayanamsa — the rasi and navamsa charts, Vimshottari dasha, planetary positions and dosha checks — and explains it in language you can actually use.',
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

/**
 * Localized feature content, keyed first by BCP-47 locale code then by path.
 * Only add a locale once its copy has been reviewed by a native speaker —
 * absent locales fall back to NO section (not to English).
 */
export const FEATURE_CONTENT_LOCALE: Record<string, Record<string, FeatureContent>> = {
  hi: {
    '/numerology': {
      heading: 'अंक ज्योतिष के बारे में',
      intro: [
        'अंक ज्योतिष आपके नाम और जन्म तारीख में छिपे अंकों का विश्लेषण करके आपकी शक्तियों, जीवन दिशा और आवर्ती पैटर्न को समझता है। वैदिक परंपरा में प्रत्येक अंक एक ग्रह से जुड़ा है — जैसे 1 सूर्य से और 3 गुरु से — इसलिए अंक ज्योतिष की रूपरेखा एक संक्षिप्त ग्रह-हस्ताक्षर होती है।',
        'MyAstro360 का कैलकुलेटर आपके मूल अंक निकालता है — जीवन पथ, भाग्यांक, आत्मांक और व्यक्तित्व अंक — और प्रत्येक को सरल भाषा में समझाता है, साथ ही शुभ रंग, दिन और अनुकूल अंक भी बताता है। यह किसी ब्रांड या व्यवसाय के नाम की कंपन-अनुकूलता भी जाँचता है।',
      ],
      howItWorks: {
        heading: 'अंक ज्योतिष कैलकुलेटर कैसे काम करता है',
        steps: [
          'अपना पूरा जन्म नाम और जन्म तारीख दर्ज करें, या किसी ब्रांड/व्यवसाय का नाम विश्लेषण के लिए लिखें।',
          'हम चालडियन और पाइथागोरियन पद्धतियों से अक्षरों और अंकों को आपके मूल अंकों तक सम करते हैं।',
          'प्रत्येक अंक को उसके शासक ग्रह से जोड़कर शक्तियों, सावधानियों और समय के अनुसार व्याख्या की जाती है।',
          'आपको शुभ रंग, अनुकूल दिन और अनुकूलता सहित एक साझा की जा सकने वाली प्रोफ़ाइल मिलती है।',
        ],
      },
      faqHeading: 'अंक ज्योतिष — अक्सर पूछे जाने वाले प्रश्न',
      faqs: [
        { q: 'क्या अंक ज्योतिष कैलकुलेटर निःशुल्क है?', a: 'हाँ — पंजीकृत उपयोगकर्ताओं के लिए नाम और जन्म-अंक का मूल विश्लेषण निःशुल्क है, और पहली रीडिंग पर कोई क्रेडिट नहीं कटता।' },
        { q: 'जीवन पथ अंक (Life Path Number) क्या होता है?', a: 'जीवन पथ अंक वह एकल अंक (या मास्टर नंबर) होता है जो आपकी पूर्ण जन्म तारीख को सम करके निकाला जाता है। यह आपकी समग्र दिशा, प्राकृतिक प्रतिभाओं और जीवन में बार-बार आने वाले पाठों का वर्णन करता है।' },
        { q: 'कौन सी अंक ज्योतिष पद्धति उपयोग की जाती है?', a: 'हम चालडियन (वैदिक/भारतीय अंक ज्योतिष, जहाँ अक्षर ध्वनि और ग्रहों से मेल खाते हैं) और पाइथागोरियन (1–9 पश्चिमी अक्षर मानचित्र) दोनों की गणना करते हैं, ताकि आप अपनी पसंदीदा पद्धति में नाम अंक देख सकें।' },
        { q: 'क्या अंक ज्योतिष अच्छे व्यापार या ब्रांड नाम सुझा सकता है?', a: 'हाँ। ब्रांड विश्लेषक किसी प्रस्तावित नाम का स्कोर करता है, शासक अंक और ग्रह बताता है, और यह भी बताता है कि यह आपके क्षेत्र के लिए अनुकूल, तटस्थ है या समायोजन की जरूरत है।' },
        { q: 'क्या अंक ज्योतिष के लिए सटीक जन्म समय चाहिए?', a: 'नहीं — अंक ज्योतिष केवल आपके नाम और जन्म तारीख का उपयोग करता है, समय की नहीं। जन्म समय कुंडली/जन्म पत्रिका के लिए आवश्यक है, जो एक अलग उपकरण है।' },
      ],
    },

    '/tarot': {
      heading: 'टैरो रीडिंग के बारे में',
      intro: [
        'टैरो रीडिंग 78 पत्तों के डेक का उपयोग करती है — 22 मेजर आर्काना जो जीवन के बड़े विषयों को दर्शाते हैं और 56 माइनर आर्काना जो रोज़मर्रा के मामलों को कवर करते हैं — आपकी स्थिति को प्रतिबिंबित करने और आपके सामने के चुनाव को उजागर करने के लिए। यह स्पष्टता और दृष्टिकोण का एक उपकरण है, निश्चित भविष्यवाणी नहीं।',
        'MyAstro360 आपके पत्ते निकालता है और प्रत्येक को संदर्भ में समझाता है — सीधा या उलटा अर्थ, प्रेम, करियर या किसी विशेष प्रश्न के लिए इसका क्या संदेश है, और अगला सुझाया गया कदम क्या है।',
      ],
      howItWorks: {
        heading: 'ऑनलाइन टैरो रीडिंग कैसे काम करती है',
        steps: [
          'अपना प्रश्न मन में रखें — प्रेम, करियर, कोई निर्णय, या खुला "मुझे अभी किस पर ध्यान देना चाहिए?"',
          'फेरबदल करें और पत्ते निकालें; पत्ते पूरे 78 पत्तों के डेक से बिना दोहराव के दिए जाते हैं।',
          'प्रत्येक पत्ते की व्याख्या उसकी स्थिति और दिशा (सीधा/उलटा) के अनुसार आपके प्रश्न के सन्दर्भ में होती है।',
          'आपको एक स्पष्ट रीडिंग और एक सुझाया गया फ़ोकस मिलता है — निजी रूप से, जिस पर आप कार्य कर सकें।',
        ],
      },
      faqHeading: 'टैरो — अक्सर पूछे जाने वाले प्रश्न',
      faqs: [
        { q: 'क्या ऑनलाइन टैरो रीडिंग निःशुल्क है?', a: 'हाँ — आप प्रेम, करियर या किसी सामान्य प्रश्न के लिए निःशुल्क रीडिंग प्राप्त कर सकते हैं। यह तत्काल और निजी है।' },
        { q: 'क्या उलटे पत्ते (reversed cards) शामिल होते हैं?', a: 'हाँ। पत्ते सीधे या उलटे आ सकते हैं और रीडिंग दोनों दिशाओं की व्याख्या करती है — उलटे पत्ते अक्सर सीधे अर्थ को कमज़ोर, अवरुद्ध या आंतरिक करते हैं।' },
        { q: 'क्या टैरो भविष्य की भविष्यवाणी कर सकता है?', a: 'टैरो वर्तमान का दर्पण है — यह मौजूदा शक्तियों और यदि कुछ न बदला तो संभावित दिशा को स्पष्ट करता है, ताकि आप बेहतर निर्णय ले सकें। यह मार्गदर्शन है, निश्चित पूर्वानुमान नहीं।' },
        { q: 'मैं पत्तों से क्या पूछ सकता हूँ?', a: 'खुले, चिंतनशील प्रश्न सबसे अच्छे काम करते हैं — "इस रिश्ते के बारे में मुझे क्या जानना चाहिए?" जैसे प्रश्न "क्या मेरी शादी मार्च में होगी?" से बेहतर हैं। इससे रीडिंग कार्यात्मक मार्गदर्शन देती है।' },
        { q: 'क्या मेरी रीडिंग निजी रहती है?', a: 'हाँ। रीडिंग केवल आपके लिए तैयार होती है और सार्वजनिक नहीं की जाती; आप जब चाहें वापस आकर दोबारा रीडिंग ले सकते हैं।' },
      ],
    },

    '/vastu': {
      heading: 'वास्तु शास्त्र के बारे में',
      intro: [
        'वास्तु शास्त्र भवन निर्माण और स्थान-व्यवस्था की पारंपरिक भारतीय विज्ञान है। यह घर या कार्यस्थल के डिज़ाइन को पाँच तत्वों (पृथ्वी, जल, अग्नि, वायु, आकाश) और कार्डिनल दिशाओं के साथ संरेखित करता है ताकि प्रकाश, वायु और ऊर्जा का प्रवाह स्वास्थ्य, एकाग्रता और समृद्धि को समर्थन दे।',
        'MyAstro360 वास्तु को व्यावहारिक, कमरे-दर-कमरे मार्गदर्शन में बदलता है — रसोई, बिस्तर, तिजोरी या पढ़ाई की जगह कहाँ रखें — और वे सरल उपाय जो बिना पुनर्निर्माण के कम अनुकूल लेआउट को भी ठीक करते हैं।',
      ],
      howItWorks: {
        heading: 'वास्तु मार्गदर्शन कैसे काम करता है',
        steps: [
          'स्थान बताएँ — घर, कमरा या कार्यालय — और यह किस दिशा की ओर है।',
          'हम प्रत्येक कार्य के लिए आदर्श वास्तु दिशा और तत्व का मानचित्र बनाते हैं।',
          'जहाँ मौजूदा लेआउट भिन्न हो, हम व्यावहारिक उपाय सुझाते हैं (दर्पण, रंग, पौधे, पुनर्स्थापन)।',
          'आपको एक स्पष्ट चेकलिस्ट मिलती है जिसे आप बिना संरचनात्मक बदलावों के लागू कर सकते हैं।',
        ],
      },
      faqHeading: 'वास्तु — अक्सर पूछे जाने वाले प्रश्न',
      faqs: [
        { q: 'मुख्य प्रवेश द्वार किस दिशा में होना चाहिए?', a: 'उत्तर, पूर्व और उत्तर-पूर्व मुखी प्रवेश द्वार सबसे शुभ माने जाते हैं क्योंकि वे सुबह का प्रकाश और सकारात्मक ऊर्जा लाते हैं, परंतु हर दिशा के उपाय होते हैं — सही दिशा पूरे भूखंड पर निर्भर करती है।' },
        { q: 'वास्तु के अनुसार रसोई कहाँ होनी चाहिए?', a: 'रसोई के लिए दक्षिण-पूर्व क्षेत्र (अग्नि तत्व) आदर्श है, जिसमें रसोइया पूर्व की ओर मुँह करके भोजन बनाए। स्टोव के लिए उत्तर-पूर्व और दक्षिण-पश्चिम दिशा से बचना चाहिए।' },
        { q: 'क्या दीवारें तोड़े बिना वास्तु दोष ठीक किए जा सकते हैं?', a: 'अधिकांश मामलों में हाँ। रंग, दर्पण, रोशनी, पौधे, नमक उपाय और फर्नीचर पुनर्स्थापन से बिना किसी निर्माण कार्य के अधिकांश सामान्य वास्तु समस्याएँ ठीक होती हैं।' },
        { q: 'सोते समय सिर किस दिशा में होना चाहिए?', a: 'दक्षिण (या पूर्व) की ओर सिर और उत्तर की ओर पैर रखकर सोएँ। परंपरागत रूप से उत्तर की ओर सिर रखना निरुत्साहित किया जाता है क्योंकि यह नींद को बाधित कर सकता है।' },
        { q: 'क्या वास्तु कार्यालयों और दुकानों पर भी लागू होता है?', a: 'हाँ — स्वामी या तिजोरी दक्षिण-पश्चिम में, कर्मचारी उत्तर या पूर्व की ओर मुँह करके, और उत्तर-पूर्व में अव्यवस्था से मुक्त स्थान — ये स्थिरता और विकास के लिए सामान्य कार्यस्थल वास्तु अनुशंसाएँ हैं।' },
      ],
    },

    '/muhurat': {
      heading: 'शुभ मुहूर्त के बारे में',
      intro: [
        'मुहूर्त एक शुभ समय-खिड़की है जो किसी महत्वपूर्ण कार्य को अनुकूल ग्रह स्थितियों के अंतर्गत प्रारंभ करने के लिए चुनी जाती है। भारतीय परंपरा में पंचांग — तिथि, नक्षत्र, योग, करण और वार — के साथ-साथ चंद्रमा और शुभ ग्रहों की स्थिति का उपयोग करके विवाह, गृह प्रवेश, नया व्यवसाय या यात्रा के लिए मुहूर्त निकाला जाता है।',
        'MyAstro360 आपके कार्यक्रम और स्थान के लिए अनुकूल मुहूर्त खिड़कियाँ खोजता है और अशुभ काल (राहु काल, यमगंड, गुलिका) को स्पष्ट रूप से चिह्नित करता है।',
      ],
      howItWorks: {
        heading: 'मुहूर्त चयन कैसे काम करता है',
        steps: [
          'कार्यक्रम चुनें — विवाह, गृह प्रवेश, नामकरण, वाहन या व्यापार शुरू करना, यात्रा।',
          'हम आपके शहर और तारीख-सीमा के लिए दिन का पंचांग पढ़ते हैं।',
          'अनुकूल तिथि/नक्षत्र/योग संयोजनों को आपके कार्यक्रम प्रकार के अनुसार मिलाया जाता है।',
          'आपको अनुशंसित खिड़कियाँ मिलती हैं, जिनमें अशुभ काल स्पष्ट रूप से अंकित होता है।',
        ],
      },
      faqHeading: 'मुहूर्त — अक्सर पूछे जाने वाले प्रश्न',
      faqs: [
        { q: 'शुभ मुहूर्त क्या होता है?', a: 'शुभ मुहूर्त एक अनुकूल समय-खिड़की है जिसमें कोई महत्वपूर्ण कार्य प्रारंभ किया जाता है — पंचांग से इस प्रकार चुनी गई कि प्रारंभ अनुकूल ग्रह और चंद्र स्थितियों के साथ संरेखित हो।' },
        { q: 'मुहूर्त मेरे शहर पर क्यों निर्भर करता है?', a: 'सूर्योदय, सूर्यास्त और तिथि-नक्षत्र का सटीक समय अक्षांश-देशांतर के साथ बदलता है, और राहु काल जैसे अशुभ काल स्थानीय सूर्योदय से गणना किए जाते हैं — इसलिए सही खिड़की स्थान-विशिष्ट होती है।' },
        { q: 'राहु काल क्या है और क्या इसे टालना चाहिए?', a: 'राहु काल प्रतिदिन का लगभग 90 मिनट का अशुभ काल है जो सूर्योदय से गणना किया जाता है। नए या महत्वपूर्ण कार्य परंपरागत रूप से इसमें प्रारंभ नहीं किए जाते; नियमित कार्य ठीक रहते हैं।' },
        { q: 'क्या आप विवाह मुहूर्त खोज सकते हैं?', a: 'हाँ — विवाह मुहूर्त मुख्य कार्यक्रम प्रकारों में से एक है, जो अनुकूल तिथि, नक्षत्र और जहाँ लागू हो चातुर्मास जैसी अवधियों की परिहार के साथ मिलाया जाता है।' },
        { q: 'मुहूर्त कितने समय पहले तक योजना बना सकते हैं?', a: 'आप आगामी दिनों और हफ्तों में उपलब्ध खिड़कियों की तुलना कर सकते हैं, जो उन कार्यक्रमों की अग्रिम योजना के लिए उपयोगी है जिनमें पहले से तैयारी की ज़रूरत होती है।' },
      ],
    },

    '/palmistry': {
      heading: 'हस्त रेखा के बारे में',
      intro: [
        'हस्त रेखा विज्ञान हाथ की रेखाओं, पर्वतों और आकृति को पढ़कर स्वभाव, शक्तियों और जीवन की व्यापक रूपरेखा का वर्णन करता है। चार प्रमुख रेखाएँ — हृदय, मस्तिष्क, जीवन और भाग्य — और ग्रहों के नाम से पुकारे जाने वाले पर्वत मिलकर एक व्यक्तित्व चित्र बनाते हैं।',
        'MyAstro360 आपकी हथेली की फ़ोटो का विश्लेषण करता है और प्रत्येक रेखा और पर्वत का अर्थ सरल भाषा में बताता है — बिना किसी जटिल शब्दावली के और बिना कुछ अस्पष्ट छोड़े।',
      ],
      howItWorks: {
        heading: 'AI हस्त रेखा विश्लेषण कैसे काम करता है',
        steps: [
          'अपनी प्रमुख हथेली की स्पष्ट, अच्छी रोशनी वाली फ़ोटो अपलोड करें।',
          'हम प्रमुख रेखाओं (हृदय, मस्तिष्क, जीवन, भाग्य) और ग्रह पर्वतों की पहचान करते हैं।',
          'प्रत्येक विशेषता की व्यक्तित्व, संबंधों, करियर और जीवनशक्ति के लिए व्याख्या होती है।',
          'आपको एक पठनीय सारांश मिलता है जिसे आप कभी भी दोबारा देख सकते हैं।',
        ],
      },
      faqHeading: 'हस्त रेखा — अक्सर पूछे जाने वाले प्रश्न',
      faqs: [
        { q: 'क्या हस्त रेखा रीडिंग निःशुल्क है?', a: 'हाँ — आप हथेली की फ़ोटो अपलोड करके अपनी प्रमुख रेखाओं और पर्वतों की निःशुल्क AI-सहायक रीडिंग प्राप्त कर सकते हैं।' },
        { q: 'कौन से हाथ की फ़ोटो लेनी चाहिए?', a: 'अपने प्रमुख हाथ (जिससे लिखते हैं) की फ़ोटो लें — यह आपके सक्रिय, वर्तमान जीवन को दर्शाता है। गैर-प्रमुख हाथ विरासत में मिले गुणों के लिए पढ़ा जाता है; कई पाठक दोनों की तुलना करते हैं।' },
        { q: 'अच्छी हथेली फ़ोटो कैसे लें?', a: 'अपनी खुली हथेली को तेज़, समान रोशनी में फ़ोटो लें — उँगलियाँ थोड़ी फैली हों, रेखाएँ स्पष्ट दिखती हों, कोई चमक या छाया न हो। सादा पृष्ठभूमि मदद करती है।' },
        { q: 'चार प्रमुख रेखाओं का अर्थ क्या है?', a: 'हृदय रेखा भावनाओं और संबंधों को, मस्तिष्क रेखा सोच और निर्णयों को, जीवन रेखा जीवनशक्ति और जीवन परिवर्तनों को, और भाग्य रेखा करियर और परिस्थितियों के प्रभाव को दर्शाती है।' },
        { q: 'क्या मेरी हथेली की फ़ोटो निजी रहती है?', a: 'आपकी रीडिंग केवल आपके लिए निजी रूप से तैयार होती है और सार्वजनिक रूप से साझा नहीं की जाती।' },
      ],
    },

    '/matching': {
      heading: 'कुंडली मिलान के बारे में',
      intro: [
        'कुंडली मिलान (गुण मिलान) दो लोगों की जन्म पत्रिकाओं की तुलना करके विवाह अनुकूलता जाँचने की वैदिक विधि है। अष्टकूट प्रणाली वर्ण और वश्य से नाड़ी तक आठ कारकों को 36 अंकों से मापती है, और मंगल (मांगलिक) दोष की जाँच भी करती है।',
        'MyAstro360 पूर्ण 36-गुण स्कोर की गणना करता है, प्रत्येक कूट का दंपती के लिए क्या अर्थ है यह बताता है, मांगलिक जाँच करता है, और एक स्पष्ट, संतुलित विश्लेषण देता है — न कि केवल उत्तीर्ण/अनुत्तीर्ण।',
      ],
      howItWorks: {
        heading: 'कुंडली मिलान कैसे काम करता है',
        steps: [
          'दोनों भागीदारों के जन्म विवरण (तारीख, समय, स्थान) दर्ज करें।',
          'हम स्विस एफेमेरिस और लहरी अयनांश से प्रत्येक कुंडली की गणना करते हैं।',
          'अष्टकूट 36-अंक गुण मिलान कुल में स्कोर किए जाते हैं, मंगल दोष की जाँच के साथ।',
          'आपको स्कोर, कूट-दर-कूट स्पष्टीकरण और जहाँ प्रासंगिक हो उपाय मिलते हैं।',
        ],
      },
      faqHeading: 'कुंडली मिलान — अक्सर पूछे जाने वाले प्रश्न',
      faqs: [
        { q: 'अच्छा गुण मिलान स्कोर कितना होना चाहिए?', a: '36 में से 18 और उससे ऊपर पारंपरिक रूप से स्वीकार्य माना जाता है, 24–32 बहुत अच्छा है, और 18 से नीचे के स्कोर पर अधिक विचार उचित है। स्कोर एक मार्गदर्शक है — व्यक्तिगत कूट और दोष भी उतने ही महत्वपूर्ण हैं।' },
        { q: 'नाड़ी दोष क्या होता है?', a: 'नाड़ी सबसे अधिक भारांकित कूट (8 अंक) है जो स्वास्थ्य और संतान से जुड़ा है। नाड़ी दोष (दोनों भागीदार एक ही नाड़ी में) गंभीर माना जाता है, हालाँकि कुछ संयोजनों में नाड़ी दोष भंग होता है।' },
        { q: 'मांगलिक (मंगल) दोष क्या है?', a: 'मांगलिक दोष तब होता है जब मंगल कुंडली के कुछ विशेष भावों में बैठता है। जब एक भागीदार मांगलिक हो, तो मिलान यह देखता है कि दूसरा भी मांगलिक है या नहीं, या दोष रद्द हो गया है।' },
        { q: 'क्या दोनों के सटीक जन्म समय की आवश्यकता है?', a: 'दोनों भागीदारों का सटीक जन्म समय और स्थान सबसे विश्वसनीय मिलान देता है क्योंकि चंद्र नक्षत्र और लग्न इन्हीं पर निर्भर करते हैं।' },
        { q: 'क्या कम अनुकूलता अंतिम निर्णय है?', a: 'नहीं। कम स्कोर उन क्षेत्रों को उजागर करता है जिन्हें समझना ज़रूरी है और, जहाँ परंपरा की अनुमति हो, उपाय भी सुझाता है। कम स्कोर वाले कई जोड़े उन कारकों पर बहुत अच्छी तरह मेल खाते हैं जो उन्हें महत्वपूर्ण लगते हैं।' },
      ],
    },

    '/kundli': {
      heading: 'आपकी कुंडली (जन्म पत्रिका) के बारे में',
      intro: [
        'कुंडली (जन्म कुंडली) आपकी वैदिक जन्म पत्रिका है — आपके जन्म के सटीक क्षण और स्थान पर आकाश का एक चित्र। यह बारह भावों और सिद्धांत राशि चक्र में ग्रहों को मानचित्रित करती है, और इससे आपकी दशाएँ (ग्रह काल), योग, दोष और जीवन की घटनाओं का समय प्रवाहित होता है।',
        'MyAstro360 स्विस एफेमेरिस और लहरी अयनांश के साथ एक पूर्ण कुंडली तैयार करता है — राशि और नवमांश चार्ट, विंशोत्तरी दशा, ग्रह स्थिति और दोष जाँच — और इसे उस भाषा में समझाता है जिसे आप वास्तव में उपयोग कर सकते हैं।',
      ],
      howItWorks: {
        heading: 'कुंडली जेनरेटर कैसे काम करता है',
        steps: [
          'अपनी जन्म तारीख, सटीक समय और जन्म स्थान दर्ज करें।',
          'हम स्विस एफेमेरिस और लहरी (सायन) अयनांश से ग्रह स्थितियों की गणना करते हैं।',
          'आपके चार्ट (D-1, D-9), दशा काल, योग और दोष निकाले जाते हैं।',
          'आपको एक पठनीय चार्ट मिलता है जिसे आप कभी भी देख सकते हैं — पहली कुंडली निःशुल्क।',
        ],
      },
      faqHeading: 'कुंडली — अक्सर पूछे जाने वाले प्रश्न',
      faqs: [
        { q: 'क्या कुंडली निःशुल्क है?', a: 'हाँ — प्रत्येक पंजीकृत उपयोगकर्ता के लिए पहली वैदिक कुंडली निःशुल्क है, और आप अपना विवरण दोबारा दर्ज किए बिना जब चाहें इसे देख सकते हैं।' },
        { q: 'कुंडली के लिए सटीक जन्म समय क्यों महत्वपूर्ण है?', a: 'लग्न और भाव कुंड प्रत्येक चार मिनट में लगभग एक डिग्री बदलते हैं, इसलिए सटीक जन्म समय ही ग्रहों को सही भावों में रखता है। कुछ मिनट का अंतर भी लग्न बदल सकता है।' },
        { q: 'आप कौन सा अयनांश उपयोग करते हैं?', a: 'लहरी अयनांश — मानक भारतीय पंचांग और सरकार की कैलेंडर सुधार समिति द्वारा मान्यता प्राप्त सायन शून्य बिंदु — जो चार्ट, दशा और गोचर में समान रूप से लागू होता है।' },
        { q: 'कुंडली में क्या शामिल होता है?', a: 'राशि (D-1) और नवमांश (D-9) चार्ट, उपखंडों के साथ विंशोत्तरी दशा, राशि, अंश और नक्षत्र के अनुसार ग्रह स्थितियाँ, भाव स्वामित्व, प्रमुख योग, और दोष जाँच (मांगलिक, काल सर्प, नाड़ी, पितृ)।' },
        { q: 'चार्ट कितना सटीक है?', a: 'चार्ट स्विस एफेमेरिस से आते हैं — वही खगोलीय इंजन जो पेशेवर ज्योतिषी उपयोग करते हैं। एक जैसे इनपुट हमेशा एक जैसा चार्ट देते हैं, कुछ भी यादृच्छिक नहीं है।' },
      ],
    },
  },
};

/**
 * Resolve feature content for a given locale and path.
 * Returns undefined (not English fallback) when no translation exists,
 * so the caller can choose to render nothing rather than mixed-language copy.
 */
export function getFeatureContent(locale: string, path: string): FeatureContent | undefined {
  if (!locale || locale === 'en') return FEATURE_CONTENT[path];
  return FEATURE_CONTENT_LOCALE[locale]?.[path];
}

/**
 * Locales in which the Tier-A feature pages have REAL long-form content
 * (English + every locale with a FEATURE_CONTENT_LOCALE section).
 *
 * This is the single source of truth that keeps the three discovery
 * surfaces aligned: the sitemap (sitemap-entries.ts), the hreflang
 * alternates (page-metadata.ts defaults) and the visible "Also available
 * in" language rows (LanguageLinkRow default) all derive from it — so
 * Google is only pointed at locale variants that carry real content, and
 * adding a translation here auto-expands all three at once. Thin locale
 * pages stay live (200, self-canonical) — they're just not advertised.
 */
export function featureContentLocales(): Locale[] {
  return ['en', ...Object.keys(FEATURE_CONTENT_LOCALE).filter((l) => l !== 'en')] as Locale[];
}
