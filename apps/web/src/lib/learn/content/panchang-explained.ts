import type { LearnArticle } from "../articles";

export const panchangExplained: LearnArticle = {
  slug: "panchang-explained",
  title: "How to Read a Panchang — The Five Limbs Explained",
  description:
    "How to read a daily panchang: what tithi, nakshatra, yoga, karana and vara actually measure, and how each is computed from the Sun and Moon for your city.",
  keywords: [
    "panchang",
    "how to read panchang",
    "tithi",
    "nakshatra",
    "yoga",
    "karana",
    "vara",
    "panchangam",
    "hindu calendar",
  ],
  datePublished: "2026-07-13",
  dateModified: "2026-07-13",
  hero: {
    eyebrow: "Vedic foundations",
    headline: "How do you read a panchang?",
    tagline:
      "The daily Hindu almanac looks dense at first — but it is just five measurements of the Sun and Moon, and each one is easier than it looks.",
  },
  sections: [
    {
      heading: "The short answer",
      paragraphs: [
        "You read a panchang by checking its five limbs in order: tithi (the lunar day), nakshatra (the Moon's lunar mansion), yoga (a Sun–Moon combination), karana (half a tithi), and vara (the weekday). Each entry names the element ruling at your local sunrise and the time it ends, so you know what governs the rest of the day.",
        "The word itself says what it is: pancha (five) plus anga (limbs). A panchang is not a forecast — it is an astronomical table. Every value in it follows from just two moving points, the Sun and the Moon, measured along the ecliptic for a specific place and date.",
      ],
    },
    {
      heading: "The five limbs, one by one",
      paragraphs: [
        "Each limb is a different way of slicing the Sun–Moon relationship. Here is what each one measures astronomically:",
      ],
      bullets: [
        "Tithi — the lunar day. One tithi is each 12° of angular separation between the Moon and the Sun, giving 30 tithis per lunar month: 15 in the waxing (shukla) half from new moon to full, and 15 in the waning (krishna) half back to new.",
        "Nakshatra — the Moon's position among the 27 lunar mansions, each spanning 13°20′ of the sidereal zodiac. The Moon crosses roughly one nakshatra per day.",
        "Yoga — the sum of the Sun's and Moon's longitudes, divided into 27 equal arcs of 13°20′. The 27 yogas run from Vishkambha to Vaidhriti, each with a traditional quality.",
        "Karana — half a tithi, i.e. each 6° of Moon–Sun separation, giving 60 karana slots per lunar month filled by 11 named karanas (7 repeating, 4 fixed).",
        "Vara — the weekday, which in the Hindu reckoning runs from one sunrise to the next, each day ruled by a planet: Sun on Sunday through Saturn on Saturday.",
      ],
    },
    {
      heading: "How a daily panchang is computed for your city",
      paragraphs: [
        "The calculation is deterministic astronomy. First, the software computes the exact longitudes of the Sun and the Moon from an ephemeris — MyAstro360 uses the Swiss Ephemeris, the same high-precision data set behind professional astrology software. For the nakshatra and yoga, which live on the sidereal zodiac, the Lahiri (Chitrapaksha) ayanamsa is subtracted to convert tropical positions to sidereal ones. Tithi and karana need no ayanamsa at all, because they are differences between the two bodies — the offset cancels out.",
        "Second, the software computes local sunrise for your coordinates. This is why a panchang is always city-specific: sunrise in Kolkata and sunrise in London happen at different moments, so the tithi or nakshatra prevailing at sunrise — the one that traditionally rules the day — can differ between cities on the same date. The published end times are simply the instants the Moon–Sun geometry crosses the next 12°, 13°20′, or 6° boundary, converted to your local clock.",
        "Same inputs, same output: given the same date, time zone, and coordinates, the panchang is identical every time. Where two panchangs disagree, the cause is almost always a different ayanamsa or a different city, not a different opinion.",
      ],
    },
    {
      heading: "Reading it in practice",
      paragraphs: [
        "Start at the top: date, city, and sunrise time — everything else hangs off these. Then read the five limbs, noting when each ends. A tithi listed as ending at 14:32 means the next tithi governs from that moment, so an event at 16:00 falls under the next lunar day, not the one printed first.",
        "Most daily panchangs also list derived windows built from the same data: rahu kaal and other inauspicious spans carved out of the sunrise-to-sunset day, and favourable moments like abhijit muhurta around local noon. These are conveniences, not extra astronomy — they all follow from sunrise, sunset, and the weekday.",
      ],
    },
    {
      heading: "What a panchang can and cannot tell you",
      paragraphs: [
        "The astronomy in a panchang is fact: the Moon really is a measurable number of degrees ahead of the Sun at any instant. What each limb means — that a particular tithi favours beginnings, or a particular yoga is delicate — is classical interpretation, a tradition refined over centuries but not a law of nature. It is a lens for choosing your moment thoughtfully, not a verdict on your day.",
        "Use it that way: as a rhythm to plan with, held lightly. No combination of limbs dooms a date, and nothing in a panchang overrides your own judgment about what a day requires.",
      ],
    },
  ],
  definedTerm: {
    term: "Panchang",
    definition:
      "A panchang is the daily Hindu astronomical almanac built from five limbs — tithi, nakshatra, yoga, karana, and vara — each computed from the Sun's and Moon's positions and local sunrise for a specific city and date.",
  },
  howTo: {
    heading: "How to read a daily panchang in 5 steps",
    steps: [
      "Confirm the panchang is set to your city and date, since every limb is anchored to local sunrise.",
      "Read the tithi and note its end time to know which lunar day governs the hours you care about.",
      "Check the nakshatra the Moon occupies and when it changes, as it colours the day's tone and many muhurta rules.",
      "Scan the yoga and karana with their end times for the finer qualities traditional texts assign them.",
      "Note the vara's planetary ruler and the derived windows such as rahu kaal before fixing the time of your activity.",
    ],
  },
  faqs: [
    {
      q: "Why does the panchang differ between two cities on the same date?",
      a: "Because the ruling limbs are fixed at local sunrise, and sunrise differs by longitude and latitude. The Moon–Sun geometry is the same for everyone at a given instant, but the tithi or nakshatra prevailing when the Sun rises in Delhi can have already ended by sunrise in New York — so each city gets its own table.",
    },
    {
      q: "What does it mean when a tithi ends at, say, 14:32?",
      a: "It means the Moon reaches the next 12° of separation from the Sun at that clock time in your city. Until 14:32 the listed tithi governs; after it, the next one does. The same logic applies to nakshatra, yoga, and karana end times — a panchang is a timetable of these boundary crossings.",
    },
    {
      q: "Is an inauspicious yoga or karana something to worry about?",
      a: "No — calmly, no. These labels are traditional qualities assigned to slices of the Sun–Moon cycle, meant to help you pick a smoother moment for important starts, not to threaten the day. Millions of ordinary, good days pass under so-called inauspicious yogas. If timing matters to you, choose a better window; if it doesn't, carry on.",
    },
    {
      q: "Why do some panchangs show a tithi repeating or skipped?",
      a: "Because tithis are measured in degrees, not hours, and the Moon's speed varies. A tithi lasts anywhere from about 20 to 26 hours, so occasionally one spans two sunrises (repeating in the almanac) or begins and ends between sunrises (appearing skipped). Nothing is lost — it is pure geometry meeting the sunrise-anchored day.",
    },
    {
      q: "How accurate is an online panchang?",
      a: "As accurate as its ephemeris and settings. MyAstro360 computes positions with the Swiss Ephemeris using the Lahiri (Chitrapaksha) ayanamsa — the standard for Indian panchangs — so the astronomy is deterministic: same date, city, and settings always yield the same result. Small differences between sources usually trace to a different ayanamsa choice, not calculation error.",
    },
  ],
  toolLinks: [
    {
      label: "Today's panchang for your city",
      href: "/panchang",
      blurb: "All five limbs with end times, computed from Swiss Ephemeris for your location.",
    },
  ],
  related: ["rahu-kaal", "choosing-muhurat", "nakshatras-overview"],
};
