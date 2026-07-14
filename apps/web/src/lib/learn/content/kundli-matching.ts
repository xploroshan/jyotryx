import type { LearnArticle } from "../articles";

export const kundliMatching: LearnArticle = {
  slug: "kundli-matching",
  title: "Kundli Matching Explained — Guna Milan & the 36 Points",
  description:
    "How kundli matching works: the Ashtakoota (guna milan) system, all 8 kootas from Varna to Nadi, how the 36-point score is computed, and how to read it honestly.",
  keywords: [
    "kundli matching",
    "guna milan",
    "ashtakoota",
    "36 gunas",
    "horoscope matching",
    "nadi dosha",
    "bhakoot dosha",
    "marriage compatibility",
  ],
  datePublished: "2026-07-13",
  dateModified: "2026-07-13",
  hero: {
    eyebrow: "Compatibility",
    headline: "How does kundli matching (guna milan / ashtakoota) work?",
    tagline:
      "The 36-point system is simpler than it looks — eight comparisons between two Moon positions, each measuring one dimension of a shared life.",
  },
  sections: [
    {
      heading: "The 36-point answer",
      paragraphs: [
        "Kundli matching, or guna milan, compares two birth charts using the Ashtakoota system: eight kootas (compatibility factors) worth 1 to 8 points each, totalling 36. Each koota is scored from the two partners' Moon signs and janma nakshatras. Traditionally, 18 or more points is considered an acceptable match, with higher totals indicating stronger natural alignment.",
        "The word Ashtakoota literally means 'eight categories'. Every point in the final score traces to one of these eight comparisons — there is nothing hidden in the total, which is why two correctly computed reports from any source should agree exactly.",
      ],
    },
    {
      heading: "The eight kootas and what each measures",
      paragraphs: [
        "The kootas are weighted by how central classical astrologers considered each dimension, from 1 point up to 8. In order of weight:",
      ],
      bullets: [
        "Varna (1 point) — temperamental class and ego compatibility, from the Moon sign",
        "Vashya (2 points) — mutual influence and adaptability between the two Moon signs",
        "Tara (3 points) — birth-star compatibility, counted between the two nakshatras, read as shared wellbeing and fortune",
        "Yoni (4 points) — instinctive and physical compatibility, from the animal symbol assigned to each nakshatra",
        "Graha Maitri (5 points) — friendship between the lords of the two Moon signs, read as mental rapport and shared outlook",
        "Gana (6 points) — temperament type (deva, manushya, or rakshasa nakshatra groups), read as behavioural compatibility",
        "Bhakoot (7 points) — the distance between the two Moon signs, read as emotional harmony and the practical rhythm of shared life",
        "Nadi (8 points) — the nakshatra's nadi group (adi, madhya, or antya), traditionally linked to health and progeny; the heaviest-weighted koota",
      ],
    },
    {
      heading: "How the score is computed",
      paragraphs: [
        "Everything starts from two accurately cast charts. Each partner's birth date, time, and place fixes the Moon's sidereal position; on MyAstro360 that computation uses the Swiss Ephemeris with the Lahiri (Chitrapaksha) ayanamsa — the standard reference of Indian panchangs. The process is deterministic: the same inputs always produce the same chart and the same score.",
        "From the Moon's degree, each person gets a Moon sign (rashi) and a janma nakshatra. The eight kootas are then scored one by one from classical lookup tables — for example, Gana compares which of the three temperament groups each nakshatra belongs to, while Bhakoot counts the sign distance between the two Moons. Each koota awards between zero and its maximum, and the eight results are summed to a total out of 36.",
        "Because the whole system reads only the two Moon positions, kundli matching does not require the full charts to agree on everything else — which is also its main limitation, discussed below.",
      ],
    },
    {
      heading: "Reading the score without fear",
      paragraphs: [
        "The traditional thresholds: below 18 points is classically considered weak, 18 to 24 acceptable, 25 to 32 very good, and 33 to 36 excellent. But the total alone is an incomplete reading. Astrologers pay close attention to which kootas scored zero — Nadi dosha (0 in Nadi) and Bhakoot dosha (0 in Bhakoot) are traditionally weighted more seriously than a modest total spread evenly across categories, and classical texts also describe specific cancellations for both.",
        "A low score is an indicator to discuss, not a verdict on a relationship. It flags specific dimensions — temperament, mental rapport, emotional rhythm — where the two Moon placements differ, so a couple or their families know what to look at more carefully. Many practitioners follow up a low guna count by examining the full charts: the seventh house, Venus, the navamsa, and any manglik considerations on both sides.",
      ],
    },
    {
      heading: "Honest limits of guna milan",
      paragraphs: [
        "Ashtakoota is an interpretive tradition, not a measured fact about two people. It reads exactly two data points — the Moon positions at each birth — and says nothing about shared values, communication, or circumstance. Treat the score as a structured conversation starter grounded in a specific classical method, alongside everything else you know about each other.",
        "It is also worth knowing that guna milan is the North Indian convention; South Indian traditions use a related but different set of porutham factors. Neither is more 'correct' — they are different classical lenses on the same two charts.",
      ],
    },
  ],
  definedTerm: {
    term: "Ashtakoota (guna milan)",
    definition:
      "The classical Vedic method of marriage compatibility that compares two birth charts across eight kootas — Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, and Nadi — scoring each from the partners' Moon signs and nakshatras for a maximum of 36 points.",
  },
  howTo: {
    heading: "How a guna milan score is computed",
    steps: [
      "Cast both birth charts from each partner's date, time, and place of birth using a sidereal ephemeris.",
      "Read each person's Moon sign (rashi) and janma nakshatra from the Moon's exact sidereal degree.",
      "Score each of the eight kootas from its classical lookup table, comparing the two Moon positions dimension by dimension.",
      "Sum the eight koota scores to get the total out of 36.",
      "Check any zero-scoring kootas — especially Nadi and Bhakoot — against their classical cancellation rules before drawing conclusions.",
      "Read the result alongside the full charts, including the seventh house, navamsa, and manglik status of both partners.",
    ],
  },
  faqs: [
    {
      q: "What is a good score in kundli matching?",
      a: "Classically, 18 out of 36 is the acceptance threshold; 18 to 24 is considered average, 25 to 32 very good, and 33 to 36 excellent. But astrologers read the breakdown, not just the total — a 24 with healthy Nadi and Bhakoot scores is usually read more favourably than a 26 with a zero in either.",
    },
    {
      q: "We scored below 18 — does that mean we shouldn't marry?",
      a: "No. A low guna count is an indicator to discuss, not a verdict. It means the two Moon placements differ on several classical dimensions, which is a prompt to look deeper — at the full charts, the navamsa, and the specific kootas that scored low — and, more importantly, at the relationship itself. The tradition itself includes cancellations and fuller-chart overrides; the number was never meant to stand alone.",
    },
    {
      q: "What is Nadi dosha and how serious is it?",
      a: "Nadi dosha occurs when both partners' nakshatras fall in the same nadi group (adi, madhya, or antya), scoring 0 of the 8 Nadi points. It is traditionally treated as the most significant single mismatch, but classical texts also list clear cancellations — for instance when the partners share a nakshatra with different padas, or when Moon signs and their lords are compatible. An astrologer checks these before calling the dosha effective.",
    },
    {
      q: "Why do the two people's Moon positions matter so much?",
      a: "In Jyotish the Moon represents the mind and emotional nature, so a marriage method built on the Moon is asking how two temperaments live together day to day. All eight kootas derive from the Moon's sign or nakshatra. That focus is deliberate — and it is also why serious matching supplements guna milan with the full charts, which carry everything the Moon alone cannot.",
    },
    {
      q: "Can two different websites give different guna milan scores?",
      a: "They shouldn't, if both compute correctly. The score is deterministic: the same birth details, the same ayanamsa, and the same classical tables always yield the same 36-point breakdown. Differences usually come from a wrong birth time, a different ayanamsa setting, or a site applying non-standard variants. MyAstro360 uses the Swiss Ephemeris with the Lahiri ayanamsa throughout.",
    },
  ],
  toolLinks: [
    {
      label: "Match two kundlis free",
      href: "/matching",
      blurb: "Full Ashtakoota breakdown — all 8 kootas scored, with plain-language notes.",
    },
  ],
  related: ["kundli", "manglik-dosha", "navamsa-d9"],
};
