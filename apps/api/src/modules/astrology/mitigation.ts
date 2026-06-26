/**
 * Structured, multi-modal mitigation engine.
 *
 * The older `remedy-temples.ts` exposed temple-only remedies for the four
 * marriage/chart doshas. This module generalises that into a full mitigation
 * PLAN for any adverse condition — not just "where to go", but what to *do*:
 *
 *   • temples / religious places (location-rankable, with coordinates)
 *   • food & diet (what to favour, fasting/vrat days)
 *   • activities & lifestyle (daily practice, charity/daan, service)
 *   • gemstones · mantras · rudraksha (with the standard cautions)
 *
 * Every adverse condition maps to a primary graha; the bulk of the remedy
 * content is therefore composed from a per-planet library (PLANET_REMEDIES)
 * plus condition-specific framing (overview, deity, signature temples, ritual).
 * This keeps the dataset DRY: a "weak Saturn" and "Sade Sati" both draw on
 * Saturn's gemstone/mantra/charity, but carry their own overview + temples.
 *
 * The content here is deterministic astrological convention (English). The web
 * layer localises the section CHROME (headings, the consult-an-astrologer
 * caution); deeper per-locale translation of the prose is a KB-backfill
 * follow-up, mirroring how the placement library was localised.
 *
 * Coordinates are approximate (town centre) and exist only to rank "nearest to
 * you" from a user's browser location and to seed a maps deep-link — not for
 * navigation.
 */

export type Planet =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn'
  | 'Rahu'
  | 'Ketu';

export type MitigationModality =
  | 'temple'
  | 'food'
  | 'activity'
  | 'charity'
  | 'fasting'
  | 'gemstone'
  | 'mantra'
  | 'rudraksha';

export interface MitigationPlace {
  name: string;
  place: string;
  state: string;
  lat: number;
  lng: number;
  why: string;
  /** Filled in by the ranker when user coordinates are supplied. */
  distanceKm?: number;
}

export interface MitigationItem {
  /** Short label, e.g. "Red Coral (Moonga)". */
  title: string;
  /** Plain-language explanation of what to do and why it helps. */
  detail: string;
  /** Optional safety note (e.g. test/consult before wearing a gemstone). */
  caution?: string;
}

export interface MitigationGroup {
  modality: MitigationModality;
  items: MitigationItem[];
}

export interface MitigationPlan {
  /** Canonical issue key, e.g. "mangal", "sade_sati", "weak_saturn". */
  issue: string;
  /** Human label, e.g. "Mangal Dosha (Manglik)". */
  label: string;
  /** Primary graha the remedies target (display + composition). */
  planet?: Planet;
  /** Deity / figure traditionally propitiated. */
  deity: string;
  /** Plain "what this is + what to expect" framing — never fear-mongering. */
  overview: string;
  /** Maps-search query for the "near me" fallback. */
  searchQuery: string;
  /** Signature + pooled temples, optionally distance-ranked. */
  temples: MitigationPlace[];
  /** Non-temple modalities (food, activity, charity, fasting, gem/mantra/rudraksha). */
  groups: MitigationGroup[];
  /** Fixed advisory note. */
  disclaimer: string;
}

const DISCLAIMER =
  'These are traditional, supportive practices — not a substitute for professional medical, legal, or financial advice. Consult a qualified astrologer before wearing any gemstone.';

const GEM_CAUTION =
  'Gemstones are potent — have your chart checked by a qualified astrologer before wearing, and choose a real, untreated stone.';

/* ────────────────────────────────────────────────────────────────────────
 * Per-planet remedy library — the reusable backbone.
 * ──────────────────────────────────────────────────────────────────────── */

interface PlanetRemedy {
  gemstone: MitigationItem;
  mantra: MitigationItem;
  rudraksha: MitigationItem;
  charity: MitigationItem;
  fasting: MitigationItem;
  food: MitigationItem;
  activity: MitigationItem;
}

export const PLANET_REMEDIES: Record<Planet, PlanetRemedy> = {
  Sun: {
    gemstone: {
      title: 'Ruby (Manik)',
      detail:
        'A natural ruby of at least 3 carats set in gold, worn on the ring finger on a Sunday morning of the waxing moon, strengthens the Sun — vitality, confidence and standing.',
      caution: GEM_CAUTION,
    },
    mantra: {
      title: 'Surya Beej Mantra',
      detail:
        'Chant "Om Hraam Hreem Hraum Sah Suryaya Namah" 7,000 times over 40 days, ideally at sunrise. The simple "Om Suryaya Namah" daily also helps.',
    },
    rudraksha: {
      title: '1-Mukhi (or 12-Mukhi) Rudraksha',
      detail: 'The one- or twelve-faced rudraksha is linked to the Sun and supports clarity, leadership and self-worth.',
    },
    charity: {
      title: 'Donate on Sundays',
      detail: 'Give wheat, jaggery, copper or red cloth to the needy on Sundays; honour and care for your father and elders.',
    },
    fasting: {
      title: 'Sunday vrat',
      detail: 'A light Sunday fast (one meal, no salt) taken with devotion is the classic Surya observance.',
    },
    food: {
      title: 'Favour Sun foods',
      detail: 'Wheat, jaggery and warm, freshly cooked sattvic food; take early morning sunlight. Avoid skipping breakfast.',
    },
    activity: {
      title: 'Offer water to the Sun (Arghya)',
      detail: 'Offer water to the rising Sun from a copper vessel each morning while facing east; practise Surya Namaskar.',
    },
  },
  Moon: {
    gemstone: {
      title: 'Pearl (Moti)',
      detail:
        'A natural pearl of 4+ carats set in silver, worn on the little finger on a Monday evening, steadies the Moon — emotions, calm and rest.',
      caution: GEM_CAUTION,
    },
    mantra: {
      title: 'Chandra Beej Mantra',
      detail: 'Chant "Om Shraam Shreem Shraum Sah Chandraya Namah" 11,000 times over 40 days; or "Om Chandraya Namah" daily.',
    },
    rudraksha: {
      title: '2-Mukhi Rudraksha',
      detail: 'The two-faced rudraksha is linked to the Moon and supports emotional balance and harmony in relationships.',
    },
    charity: {
      title: 'Donate on Mondays',
      detail: 'Give rice, milk, white cloth or silver on Mondays; care for your mother and offer water to those in need.',
    },
    fasting: {
      title: 'Monday vrat',
      detail: 'A Monday fast (fruit and milk) devoted to Shiva calms an afflicted or weak Moon.',
    },
    food: {
      title: 'Favour Moon foods',
      detail: 'Milk, rice, and cooling white foods; stay hydrated and keep a steady sleep routine.',
    },
    activity: {
      title: 'Spend calm time near water',
      detail: 'Sit by water, meditate, and keep a regular sleep rhythm; drink water kept overnight in a silver glass.',
    },
  },
  Mars: {
    gemstone: {
      title: 'Red Coral (Moonga)',
      detail:
        'A natural red coral of 5+ carats set in gold or copper, worn on the ring finger on a Tuesday, channels Mars — courage and drive — and is the classic Manglik stone.',
      caution: GEM_CAUTION,
    },
    mantra: {
      title: 'Mangal Beej Mantra',
      detail: 'Chant "Om Kraam Kreem Kraum Sah Bhaumaya Namah" 10,000 times over 40 days; recite the Hanuman Chalisa on Tuesdays.',
    },
    rudraksha: {
      title: '3-Mukhi Rudraksha',
      detail: 'The three-faced rudraksha is linked to Mars and helps release anger, guilt and restlessness.',
    },
    charity: {
      title: 'Donate on Tuesdays',
      detail: 'Give red lentils (masoor), jaggery or red cloth on Tuesdays; feed a sweet chapati to dogs.',
    },
    fasting: {
      title: 'Tuesday vrat',
      detail: 'A Tuesday fast devoted to Hanuman cools the heat of Mars.',
    },
    food: {
      title: 'Cool the Mars heat',
      detail: 'Favour cooling foods; reduce excess red meat, chilli and stimulants that aggravate irritability.',
    },
    activity: {
      title: 'Channel energy & worship Hanuman',
      detail: 'Burn off restlessness with exercise; visit a Hanuman temple on Tuesdays and avoid reckless risk-taking.',
    },
  },
  Mercury: {
    gemstone: {
      title: 'Emerald (Panna)',
      detail:
        'A natural emerald of 3+ carats set in gold, worn on the little finger on a Wednesday, sharpens Mercury — intellect, speech and trade.',
      caution: GEM_CAUTION,
    },
    mantra: {
      title: 'Budh Beej Mantra',
      detail: 'Chant "Om Braam Breem Braum Sah Budhaya Namah" 9,000 times over 40 days; or "Om Budhaya Namah" daily.',
    },
    rudraksha: {
      title: '4-Mukhi Rudraksha',
      detail: 'The four-faced rudraksha is linked to Mercury and supports focus, learning and clear communication.',
    },
    charity: {
      title: 'Donate on Wednesdays',
      detail: 'Give green moong dal, green cloth or books on Wednesdays; feed green grass to cows.',
    },
    fasting: {
      title: 'Wednesday vrat',
      detail: 'A Wednesday observance devoted to Vishnu/Ganesha supports a weak Mercury.',
    },
    food: {
      title: 'Favour Mercury foods',
      detail: 'Green vegetables and moong; keep a calm, distraction-free routine for study and work.',
    },
    activity: {
      title: 'Learn, write and serve knowledge',
      detail: 'Read, write and teach; donate books and support a student or child’s education.',
    },
  },
  Jupiter: {
    gemstone: {
      title: 'Yellow Sapphire (Pukhraj)',
      detail:
        'A natural yellow sapphire of 3+ carats set in gold, worn on the index finger on a Thursday, strengthens Jupiter — wisdom, growth and good fortune.',
      caution: GEM_CAUTION,
    },
    mantra: {
      title: 'Guru Beej Mantra',
      detail: 'Chant "Om Graam Greem Graum Sah Gurave Namah" 19,000 times over 40 days; recite "Om Gurave Namah" on Thursdays.',
    },
    rudraksha: {
      title: '5-Mukhi Rudraksha',
      detail: 'The five-faced rudraksha is linked to Jupiter/Shiva — the most accessible bead, for protection and wisdom.',
    },
    charity: {
      title: 'Donate on Thursdays',
      detail: 'Give turmeric, chana dal, yellow cloth, ghee or books on Thursdays; honour teachers and elders.',
    },
    fasting: {
      title: 'Thursday vrat',
      detail: 'A Thursday fast (yellow food, no salt) devoted to Vishnu/Brihaspati strengthens Jupiter.',
    },
    food: {
      title: 'Favour Jupiter foods',
      detail: 'Turmeric, chana, ghee and yellow foods; keep an ethical, moderate routine.',
    },
    activity: {
      title: 'Seek and share wisdom',
      detail: 'Apply a saffron/turmeric tilak, respect mentors, study scripture, and give to learning or dharmic causes.',
    },
  },
  Venus: {
    gemstone: {
      title: 'Diamond or White Sapphire',
      detail:
        'A natural diamond (or white sapphire) set in white gold/silver, worn on the middle or ring finger on a Friday, strengthens Venus — love, comfort and the arts.',
      caution: GEM_CAUTION,
    },
    mantra: {
      title: 'Shukra Beej Mantra',
      detail: 'Chant "Om Draam Dreem Draum Sah Shukraya Namah" 16,000 times over 40 days; or "Om Shukraya Namah" on Fridays.',
    },
    rudraksha: {
      title: '6-Mukhi Rudraksha',
      detail: 'The six-faced rudraksha is linked to Venus and supports harmony, charm and relationships.',
    },
    charity: {
      title: 'Donate on Fridays',
      detail: 'Give white sweets, sugar, rice, perfume or white cloth on Fridays; honour and respect women.',
    },
    fasting: {
      title: 'Friday vrat',
      detail: 'A Friday observance devoted to Lakshmi/Devi supports Venus and prosperity.',
    },
    food: {
      title: 'Favour Venus foods',
      detail: 'Sweets in moderation, dairy and fragrant foods; keep your surroundings clean and beautiful.',
    },
    activity: {
      title: 'Cultivate beauty & relationships',
      detail: 'Engage with art, music and beauty; nurture your relationships with kindness and generosity.',
    },
  },
  Saturn: {
    gemstone: {
      title: 'Blue Sapphire (Neelam)',
      detail:
        'A natural blue sapphire of 3+ carats set in silver/white gold, worn on the middle finger on a Saturday — but ONLY after a trial period, as Saturn’s stone acts fast and strong.',
      caution:
        'Blue Sapphire must be trialled for 3–7 days and worn only on a qualified astrologer’s advice — it is the most powerful and the most cautioned stone.',
    },
    mantra: {
      title: 'Shani Beej Mantra',
      detail: 'Chant "Om Praam Preem Praum Sah Shanaischaraya Namah" 23,000 times over 40 days; recite the Hanuman Chalisa on Saturdays.',
    },
    rudraksha: {
      title: '7-Mukhi Rudraksha',
      detail: 'The seven-faced rudraksha is linked to Saturn and supports steadiness, relief from delays and good fortune.',
    },
    charity: {
      title: 'Donate on Saturdays',
      detail: 'Give black sesame (til), mustard oil, iron, black cloth or footwear on Saturdays; serve the elderly, labourers and the disabled.',
    },
    fasting: {
      title: 'Saturday vrat',
      detail: 'A Saturday fast devoted to Shani/Hanuman eases Saturn’s pressure.',
    },
    food: {
      title: 'Simple, disciplined diet',
      detail: 'Keep meals simple and regular; offer mustard oil at a Shani or Hanuman shrine and avoid intoxicants.',
    },
    activity: {
      title: 'Serve & keep discipline',
      detail: 'Serve the underprivileged and elderly, offer water to a Peepal tree, keep promises, and avoid shortcuts.',
    },
  },
  Rahu: {
    gemstone: {
      title: 'Hessonite (Gomed)',
      detail:
        'A natural hessonite of 5+ carats set in silver, worn on the middle finger on a Saturday, steadies Rahu — focus amid confusion and sudden change.',
      caution: GEM_CAUTION,
    },
    mantra: {
      title: 'Rahu Beej Mantra',
      detail: 'Chant "Om Bhraam Bhreem Bhraum Sah Rahave Namah" 18,000 times over 40 days; the Durga Saptashati also helps.',
    },
    rudraksha: {
      title: '8-Mukhi Rudraksha',
      detail: 'The eight-faced rudraksha (Ganesha) is linked to Rahu and clears obstacles and confusion.',
    },
    charity: {
      title: 'Donate on Saturdays',
      detail: 'Give radish, coconut, mustard oil, blankets or sesame on Saturdays; feed crows.',
    },
    fasting: {
      title: 'Saturday observance',
      detail: 'A Saturday discipline and Durga worship steady Rahu’s restlessness.',
    },
    food: {
      title: 'Clean, grounded diet',
      detail: 'Keep meals fresh and simple; firmly avoid intoxicants and shortcuts that Rahu tempts.',
    },
    activity: {
      title: 'Ground yourself & serve',
      detail: 'Keep an honest, decluttered routine; serve outsiders and the marginalised; worship Durga or Ganesha.',
    },
  },
  Ketu: {
    gemstone: {
      title: "Cat's Eye (Lehsunia)",
      detail:
        "A natural cat's eye of 3+ carats set in silver/gold, worn on the little finger on a Thursday, steadies Ketu — protection and spiritual focus.",
      caution: GEM_CAUTION,
    },
    mantra: {
      title: 'Ketu Beej Mantra',
      detail: 'Chant "Om Sraam Sreem Sraum Sah Ketave Namah" 17,000 times over 40 days; Ganesha worship also helps.',
    },
    rudraksha: {
      title: '9-Mukhi Rudraksha',
      detail: 'The nine-faced rudraksha (Durga) is linked to Ketu and supports protection and spiritual growth.',
    },
    charity: {
      title: 'Donate to the needy',
      detail: 'Give sesame, multicoloured blankets or food to the poor; feed dogs and support shelters.',
    },
    fasting: {
      title: 'Spiritual observance',
      detail: 'A simple fast paired with meditation or seva supports Ketu’s detaching nature.',
    },
    food: {
      title: 'Light, simple diet',
      detail: 'Keep food simple and sattvic; spend time in quiet and prayer.',
    },
    activity: {
      title: 'Practise & serve quietly',
      detail: 'Meditate, chant, and do selfless service (seva); worship Ganesha or Bhairava.',
    },
  },
};

/* ────────────────────────────────────────────────────────────────────────
 * Temple pools per deity — for "nearest to you" ranking across India.
 * ──────────────────────────────────────────────────────────────────────── */

const TEMPLE_POOLS: Record<string, MitigationPlace[]> = {
  hanuman: [
    { name: 'Salasar Balaji', place: 'Salasar', state: 'Rajasthan', lat: 27.602, lng: 74.7236, why: 'Renowned Hanuman shrine; Tuesday worship calms Mars.' },
    { name: 'Sankat Mochan Hanuman', place: 'Varanasi', state: 'Uttar Pradesh', lat: 25.2848, lng: 82.9962, why: 'Classic Hanuman temple for relief from troubles.' },
    { name: 'Hanuman Garhi', place: 'Ayodhya', state: 'Uttar Pradesh', lat: 26.7956, lng: 82.2007, why: 'Major Hanuman seat in the north.' },
    { name: 'Mehandipur Balaji', place: 'Dausa', state: 'Rajasthan', lat: 26.9, lng: 76.55, why: 'Well-known for protection and relief rituals.' },
    { name: 'Jakhoo Temple', place: 'Shimla', state: 'Himachal Pradesh', lat: 31.1, lng: 77.18, why: 'Hilltop Hanuman temple in the north.' },
    { name: 'Namakkal Anjaneyar', place: 'Namakkal', state: 'Tamil Nadu', lat: 11.2189, lng: 78.1677, why: 'Towering Hanuman shrine in the south.' },
  ],
  shiva: [
    { name: 'Trimbakeshwar Jyotirlinga', place: 'Trimbak, Nashik', state: 'Maharashtra', lat: 19.9333, lng: 73.53, why: 'Foremost site for Kaal Sarp and Nivaran pujas.' },
    { name: 'Mahakaleshwar Jyotirlinga', place: 'Ujjain', state: 'Madhya Pradesh', lat: 23.1828, lng: 75.7682, why: 'Maha Mrityunjaya Jaap here is a classic remedy.' },
    { name: 'Kashi Vishwanath', place: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3109, lng: 83.0107, why: 'Among the holiest Shiva kshetras.' },
    { name: 'Srikalahasti (Rahu-Ketu)', place: 'Srikalahasti', state: 'Andhra Pradesh', lat: 13.7497, lng: 79.6983, why: 'The Rahu-Ketu kshetra for serpent-dosha pujas.' },
    { name: 'Ramanathaswamy', place: 'Rameswaram', state: 'Tamil Nadu', lat: 9.2881, lng: 79.3174, why: 'Revered Shiva kshetra for marital harmony.' },
    { name: 'Somnath Jyotirlinga', place: 'Prabhas Patan', state: 'Gujarat', lat: 20.888, lng: 70.4012, why: 'First Jyotirlinga, in the west.' },
    { name: 'Baidyanath Jyotirlinga', place: 'Deoghar', state: 'Jharkhand', lat: 24.4924, lng: 86.7 , why: 'Major Shiva kshetra in the east.' },
  ],
  vishnu: [
    { name: 'Vishnupad Temple', place: 'Gaya', state: 'Bihar', lat: 24.796, lng: 85.0119, why: 'Foremost site for Pind Daan and ancestral Tarpan.' },
    { name: 'Badrinath', place: 'Badrinath', state: 'Uttarakhand', lat: 30.7433, lng: 79.4938, why: 'Major Vishnu dham; Brahma Kapal for Pitra rites.' },
    { name: 'Venkateswara (Tirumala)', place: 'Tirupati', state: 'Andhra Pradesh', lat: 13.6833, lng: 79.3474, why: 'Among the most revered Vishnu shrines.' },
    { name: 'Jagannath Temple', place: 'Puri', state: 'Odisha', lat: 19.8048, lng: 85.8179, why: 'Great Vishnu/Jagannath kshetra in the east.' },
    { name: 'Ranganathaswamy', place: 'Srirangam', state: 'Tamil Nadu', lat: 10.8625, lng: 78.6896, why: 'Foremost Vishnu temple in the south.' },
    { name: 'Dwarkadhish', place: 'Dwarka', state: 'Gujarat', lat: 22.2378, lng: 68.9685, why: 'Krishna/Vishnu dham in the west.' },
  ],
  shani: [
    { name: 'Shani Shingnapur', place: 'Shingnapur', state: 'Maharashtra', lat: 19.3667, lng: 74.85, why: 'The foremost Shani shrine for Sade Sati relief.' },
    { name: 'Thirunallar Saneeswaran', place: 'Thirunallar', state: 'Puducherry', lat: 10.9252, lng: 79.7886, why: 'Most revered Shani temple in the south.' },
    { name: 'Shani Dham', place: 'Asola, Delhi', state: 'Delhi', lat: 28.49, lng: 77.18, why: 'Large Shani shrine in the north.' },
    { name: 'Kokilavan Shani Dham', place: 'Kosi Kalan', state: 'Uttar Pradesh', lat: 27.79, lng: 77.43, why: 'Popular Shani pilgrimage near Mathura.' },
  ],
  devi: [
    { name: 'Vaishno Devi', place: 'Katra', state: 'Jammu & Kashmir', lat: 33.0306, lng: 74.949, why: 'Great Devi shrine for protection and grace.' },
    { name: 'Kamakhya', place: 'Guwahati', state: 'Assam', lat: 26.1664, lng: 91.7058, why: 'Foremost Shakti Peetha in the east.' },
    { name: 'Vindhyavasini', place: 'Vindhyachal', state: 'Uttar Pradesh', lat: 25.165, lng: 82.49, why: 'Major Devi shrine in the north.' },
    { name: 'Meenakshi Amman', place: 'Madurai', state: 'Tamil Nadu', lat: 9.9195, lng: 78.1193, why: 'Great Devi temple in the south; Swayamvara Parvati for marriage.' },
    { name: 'Mahalakshmi', place: 'Kolhapur', state: 'Maharashtra', lat: 16.6917, lng: 74.2228, why: 'Lakshmi shrine in the west for prosperity & relationships.' },
  ],
};

/* ────────────────────────────────────────────────────────────────────────
 * Condition definitions — overview + which planet + which temples + ritual.
 * ──────────────────────────────────────────────────────────────────────── */

interface ConditionDef {
  label: string;
  planet?: Planet;
  deity: string;
  searchQuery: string;
  overview: string;
  /** Signature temples shown first, then the relevant pool for nearest-ranking. */
  signature: MitigationPlace[];
  pool: keyof typeof TEMPLE_POOLS;
  /** Condition-specific ritual lines added to the "activity" group. */
  rituals: string[];
  /** Which planet modalities to include (defaults to all). */
  modalities?: MitigationModality[];
}

const ALL_MODALITIES: MitigationModality[] = [
  'temple',
  'food',
  'activity',
  'charity',
  'fasting',
  'gemstone',
  'mantra',
  'rudraksha',
];

const CONDITIONS: Record<string, ConditionDef> = {
  mangal: {
    label: 'Mangal Dosha (Manglik)',
    planet: 'Mars',
    deity: 'Hanuman / Mangal (Mars)',
    searchQuery: 'Hanuman temple',
    overview:
      'Mangal Dosha simply means Mars sits in a placement that can add heat and impatience to relationships and partnership. It is common and very workable — these practices cool that heat and protect harmony.',
    signature: [
      { name: 'Mangalnath Mandir', place: 'Ujjain', state: 'Madhya Pradesh', lat: 23.1985, lng: 75.7763, why: 'Considered the birthplace of Mars — the foremost site for Mangal Dosha shanti.' },
    ],
    pool: 'hanuman',
    rituals: ['Have a Mangal Shanti Puja performed on a Tuesday.', 'Where advised, the symbolic Kumbh Vivah is done before marriage.'],
  },
  kaal_sarp: {
    label: 'Kaal Sarp Dosha',
    planet: 'Rahu',
    deity: 'Shiva / Rahu-Ketu (Naga)',
    searchQuery: 'Shiva temple',
    overview:
      'Kaal Sarp forms when the planets sit on one side of the Rahu–Ketu axis. It can bring a feeling of stop-start effort. These remedies — especially Shiva worship — smooth the flow and steady your progress.',
    signature: [
      { name: 'Trimbakeshwar Shiva Temple', place: 'Trimbak, Nashik', state: 'Maharashtra', lat: 19.9333, lng: 73.53, why: 'The foremost site for Kaal Sarp Dosha Nivaran Puja.' },
      { name: 'Srikalahasti Temple', place: 'Srikalahasti', state: 'Andhra Pradesh', lat: 13.7497, lng: 79.6983, why: 'The Rahu-Ketu kshetra for serpent-dosha pujas.' },
    ],
    pool: 'shiva',
    rituals: ['Have a Kaal Sarp Dosha Nivaran Puja performed (Trimbakeshwar is traditional).', 'Offer a silver naga (snake) at a Shiva shrine on Nag Panchami.'],
  },
  nadi: {
    label: 'Nadi Dosha',
    planet: 'Moon',
    deity: 'Shiva (Maha Mrityunjaya)',
    searchQuery: 'Shiva temple',
    overview:
      'Nadi Dosha appears in matching when both partners share the same Nadi, traditionally linked to health and progeny. It is often cancelled by other factors — and where present, Shiva worship and the Maha Mrityunjaya are the classic remedies.',
    signature: [
      { name: 'Mahakaleshwar Jyotirlinga', place: 'Ujjain', state: 'Madhya Pradesh', lat: 23.1828, lng: 75.7682, why: 'Maha Mrityunjaya Jaap here before marriage is a classic Nadi remedy.' },
      { name: 'Ramanathaswamy Temple', place: 'Rameswaram', state: 'Tamil Nadu', lat: 9.2881, lng: 79.3174, why: 'A revered Shiva kshetra for marital harmony.' },
    ],
    pool: 'shiva',
    rituals: ['Have the Maha Mrityunjaya Jaap performed before marriage.', 'Offer prayers together at a Shiva temple on Mondays.'],
  },
  pitra: {
    label: 'Pitra Dosha',
    planet: 'Sun',
    deity: 'Ancestors (Pitra) / Vishnu',
    searchQuery: 'Vishnu temple',
    overview:
      'Pitra Dosha points to unfinished duties toward ancestors. Honouring them — through Tarpan, charity and remembrance — is said to lift the weight and bring their blessings forward.',
    signature: [
      { name: 'Vishnupad Temple', place: 'Gaya', state: 'Bihar', lat: 24.796, lng: 85.0119, why: 'The foremost site for Pind Daan and ancestral Tarpan.' },
    ],
    pool: 'vishnu',
    rituals: ['Perform Pind Daan / Tarpan for ancestors, especially during Pitru Paksha.', 'Offer food to crows, cows and the needy on Amavasya.', 'Plant and water a Peepal tree.'],
  },
  sade_sati: {
    label: 'Shani Sade Sati',
    planet: 'Saturn',
    deity: 'Shani / Hanuman',
    searchQuery: 'Shani temple',
    overview:
      "Sade Sati is Saturn's ~7.5-year passage around your Moon — a demanding but maturing chapter that rewards patience, honesty and steady effort. These practices ease the pressure and help you build lasting foundations.",
    signature: [
      { name: 'Shani Shingnapur', place: 'Shingnapur', state: 'Maharashtra', lat: 19.3667, lng: 74.85, why: 'The foremost Shani shrine for Sade Sati relief.' },
    ],
    pool: 'shani',
    rituals: ['Offer mustard oil and worship Shani on Saturdays.', 'Recite the Hanuman Chalisa on Saturdays.', 'Offer water to a Peepal tree and light a mustard-oil lamp on Saturdays.'],
  },
  shani_dhaiya: {
    label: 'Shani Dhaiya (Small Panoti)',
    planet: 'Saturn',
    deity: 'Shani / Hanuman',
    searchQuery: 'Shani temple',
    overview:
      "Shani Dhaiya is Saturn's ~2.5-year transit through the 4th or 8th from your Moon — a lighter version of Sade Sati that calls for patience and discipline. The same Saturn practices apply.",
    signature: [
      { name: 'Shani Shingnapur', place: 'Shingnapur', state: 'Maharashtra', lat: 19.3667, lng: 74.85, why: 'The foremost Shani shrine for relief from Saturn’s pressure.' },
    ],
    pool: 'shani',
    rituals: ['Offer mustard oil and worship Shani on Saturdays.', 'Recite the Hanuman Chalisa on Saturdays.'],
  },
  low_guna: {
    label: 'Low Compatibility Score',
    planet: 'Venus',
    deity: 'Shiva–Parvati / Lakshmi',
    searchQuery: 'Devi temple',
    overview:
      'A lower Guna score is guidance, not a verdict — many happy marriages have modest scores. These practices nurture understanding, patience and warmth between partners.',
    signature: [
      { name: 'Meenakshi Amman', place: 'Madurai', state: 'Tamil Nadu', lat: 9.9195, lng: 78.1193, why: 'Swayamvara Parvati worship here is traditional for marriage harmony.' },
    ],
    pool: 'devi',
    rituals: ['Offer prayers together to Shiva–Parvati on Mondays.', 'Perform the Swayamvara Parvati Homa for harmony where advised.'],
  },
};

/* ────────────────────────────────────────────────────────────────────────
 * Builders.
 * ──────────────────────────────────────────────────────────────────────── */

const DEITY_LABEL: Record<Planet, { deity: string; searchQuery: string; pool: keyof typeof TEMPLE_POOLS }> = {
  Sun: { deity: 'Surya / Vishnu', searchQuery: 'Surya temple', pool: 'vishnu' },
  Moon: { deity: 'Shiva (Chandra)', searchQuery: 'Shiva temple', pool: 'shiva' },
  Mars: { deity: 'Hanuman / Mangal', searchQuery: 'Hanuman temple', pool: 'hanuman' },
  Mercury: { deity: 'Vishnu / Ganesha', searchQuery: 'Vishnu temple', pool: 'vishnu' },
  Jupiter: { deity: 'Brihaspati / Vishnu', searchQuery: 'Vishnu temple', pool: 'vishnu' },
  Venus: { deity: 'Lakshmi / Devi', searchQuery: 'Lakshmi temple', pool: 'devi' },
  Saturn: { deity: 'Shani / Hanuman', searchQuery: 'Shani temple', pool: 'shani' },
  Rahu: { deity: 'Durga / Bhairava', searchQuery: 'Durga temple', pool: 'devi' },
  Ketu: { deity: 'Ganesha / Durga', searchQuery: 'Ganesha temple', pool: 'devi' },
};

function planetGroups(planet: Planet, modalities: MitigationModality[]): MitigationGroup[] {
  const r = PLANET_REMEDIES[planet];
  const map: Record<Exclude<MitigationModality, 'temple'>, MitigationItem> = {
    food: r.food,
    activity: r.activity,
    charity: r.charity,
    fasting: r.fasting,
    gemstone: r.gemstone,
    mantra: r.mantra,
    rudraksha: r.rudraksha,
  };
  const groups: MitigationGroup[] = [];
  for (const m of modalities) {
    if (m === 'temple') continue;
    const item = map[m];
    if (item) groups.push({ modality: m, items: [item] });
  }
  return groups;
}

/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Build a full mitigation plan for an issue. Known conditions (doshas, sade
 * sati, low guna) use their curated overview + temples; an unknown issue of the
 * form "weak_<planet>" / "<planet>" composes a generic plan from that planet's
 * remedy library. Returns null for an unrecognised issue.
 *
 * When `coords` are supplied, temples are distance-ranked nearest-first (the
 * signature temple is kept but also distance-tagged), so the UI can show
 * "nearest to you" without any external API.
 */
export function buildMitigationPlan(
  issue: string,
  coords?: { lat: number; lng: number } | null,
): MitigationPlan | null {
  const key = normalizeIssue(issue);
  let def = CONDITIONS[key];
  let planet: Planet | undefined;
  let label: string;
  let deity: string;
  let searchQuery: string;
  let overview: string;
  let temples: MitigationPlace[];
  let rituals: string[] = [];
  let modalities = ALL_MODALITIES;

  if (def) {
    planet = def.planet;
    label = def.label;
    deity = def.deity;
    searchQuery = def.searchQuery;
    overview = def.overview;
    temples = [...def.signature, ...TEMPLE_POOLS[def.pool].filter((t) => !def.signature.some((s) => s.name === t.name))];
    rituals = def.rituals;
    modalities = def.modalities ?? ALL_MODALITIES;
  } else {
    // Generic planet-strengthening plan ("weak_saturn", "saturn", etc.)
    const p = planetFromIssue(key);
    if (!p) return null;
    planet = p;
    const meta = DEITY_LABEL[p];
    label = `Strengthening ${p}`;
    deity = meta.deity;
    searchQuery = meta.searchQuery;
    overview = `Your ${p} can be supported with simple, steady practices. None of this is about fear — it is about gently bringing this part of your life into better balance.`;
    temples = [...TEMPLE_POOLS[meta.pool]];
  }

  const groups: MitigationGroup[] = [];
  // Temple group is represented by `temples`; other modalities come from the planet.
  if (planet) groups.push(...planetGroups(planet, modalities));

  // Fold condition rituals into an "activity" group (prepended).
  if (rituals.length > 0) {
    const ritualItems: MitigationItem[] = rituals.map((r) => ({ title: 'Ritual', detail: r }));
    const existing = groups.find((g) => g.modality === 'activity');
    if (existing) existing.items = [...ritualItems, ...existing.items];
    else groups.unshift({ modality: 'activity', items: ritualItems });
  }

  // Distance-rank temples when we know where the user is.
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    temples = temples
      .map((t) => ({ ...t, distanceKm: Math.round(haversineKm(coords, t)) }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }

  return {
    issue: key,
    label,
    planet,
    deity,
    overview,
    searchQuery,
    temples,
    groups,
    disclaimer: DISCLAIMER,
  };
}

/** Canonicalise an incoming issue string. */
function normalizeIssue(issue: string): string {
  const s = (issue || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const alias: Record<string, string> = {
    manglik: 'mangal',
    mangal_dosha: 'mangal',
    kaalsarp: 'kaal_sarp',
    kaal_sarp_dosha: 'kaal_sarp',
    nadi_dosha: 'nadi',
    pitra_dosha: 'pitra',
    pitru: 'pitra',
    sadesati: 'sade_sati',
    sade_sati: 'sade_sati',
    shani_sade_sati: 'sade_sati',
    dhaiya: 'shani_dhaiya',
    panoti: 'shani_dhaiya',
    low_score: 'low_guna',
    low_match: 'low_guna',
  };
  return alias[s] ?? s;
}

const PLANET_NAMES: Planet[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

function planetFromIssue(key: string): Planet | null {
  const bare = key.replace(/^weak_/, '').replace(/_dosha$/, '');
  const match = PLANET_NAMES.find((p) => p.toLowerCase() === bare);
  return match ?? null;
}

/** The set of issue keys that resolve to a curated condition plan. */
export const KNOWN_CONDITIONS = Object.keys(CONDITIONS);
