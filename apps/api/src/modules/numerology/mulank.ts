/**
 * Mulank — Vedic numerology root-number engine (pure, deterministic, no deps).
 *
 * Two numbers anchor Ank Jyotish (Indian numerology):
 *   • Mulank (मूलांक, "root number" / psychic number) — derived from the DAY of
 *     the month of birth, reduced to a single digit 1–9. It describes the core
 *     nature: how a person instinctively thinks and acts.
 *   • Bhagyank (भाग्यांक, "destiny number" / life-path) — derived from the FULL
 *     date of birth (day + month + year, every digit), reduced to 1–9. It
 *     describes the life direction and the rewards earned over time.
 *
 * Each number 1–9 is ruled by a planet (1 Sun, 2 Moon, 3 Jupiter, 4 Rahu,
 * 5 Mercury, 6 Venus, 7 Ketu, 8 Saturn, 9 Mars). Compatibility between two
 * numbers follows the natural friendship of their ruling planets, encoded here
 * as a symmetric relation so that compat(a,b) === compat(b,a) by construction.
 *
 * Everything in this file is a pure function of the birth date — given the same
 * date it always returns the same reading — which is what the unit tests pin.
 */

export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type MasterNumber = 11 | 22 | 33;
export type CompatRating = 'best' | 'friend' | 'neutral' | 'challenging';

export interface NumberProfile {
  number: Digit;
  planet: string;
  sanskritPlanet: string;
  element: string;
  polarity: 'masculine' | 'feminine' | 'neutral';
  title: string;
  essence: string;
  personality: string;
  strengths: string[];
  weaknesses: string[];
  careers: string[];
  luckyDays: string[];
  luckyColors: string[];
  gemstone: string;
  altGemstone: string;
  metal: string;
  deity: string;
  mantra: string;
  direction: string;
  bodyFocus: string;
  healthNote: string;
  remedies: string[];
}

export interface CalcStep {
  /** Human-readable reduction, e.g. "29 → 2 + 9 = 11 → 1 + 1 = 2". */
  expression: string;
  /** The reduced single digit. */
  value: Digit;
  /** Master number passed through during reduction, if any (11 / 22 / 33). */
  master?: MasterNumber;
  /** Raw digits that were summed, for animated/step UI. */
  digits: number[];
}

export interface CompatibilityEntry {
  number: Digit;
  planet: string;
  rating: CompatRating;
  note: string;
}

export interface MulankReading {
  dateOfBirth: string; // YYYY-MM-DD echo
  day: number;
  month: number;
  year: number;
  mulank: Digit;
  bhagyank: Digit;
  mulankMaster?: MasterNumber;
  bhagyankMaster?: MasterNumber;
  calculation: {
    mulank: CalcStep;
    bhagyank: CalcStep;
  };
  mulankProfile: NumberProfile;
  bhagyankProfile: NumberProfile;
  /** Relationship between the person's own Mulank and Bhagyank. */
  innerHarmony: {
    rating: CompatRating;
    note: string;
  };
  /** Compatibility of this Mulank with every number 1–9. */
  compatibility: CompatibilityEntry[];
  /** Convenience buckets derived from `compatibility`. */
  bestMatches: Digit[];
  friendlyMatches: Digit[];
  neutralMatches: Digit[];
  challengingMatches: Digit[];
  luckyNumbers: Digit[];
  summary: string;
}

const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const MASTERS: MasterNumber[] = [11, 22, 33];

function isMaster(n: number): n is MasterNumber {
  return n === 11 || n === 22 || n === 33;
}

function sumDigits(n: number): number {
  return Math.abs(n)
    .toString()
    .split('')
    .reduce((s, d) => s + Number(d), 0);
}

/**
 * Reduce a positive integer to a single digit 1–9, recording any master number
 * (11/22/33) encountered along the way. Returns the digit, the master (if any),
 * and a human-readable expression of the reduction.
 */
export function reduceWithSteps(n: number): CalcStep {
  const digits = Math.abs(n).toString().split('').map(Number);
  let current = Math.abs(n);
  let master: MasterNumber | undefined;
  const parts: string[] = [String(current)];

  while (current > 9) {
    if (isMaster(current)) master = current;
    const next = sumDigits(current);
    const expanded = current.toString().split('').join(' + ');
    parts.push(`${expanded} = ${next}`);
    current = next;
  }

  // Real birth dates never reduce to 0, but guard anyway.
  const value = (current === 0 ? 9 : current) as Digit;
  return {
    expression: parts.join(' → '),
    value,
    master,
    digits,
  };
}

/** Mulank = root number from the day of the month (1–31), reduced to 1–9. */
export function computeMulank(day: number): CalcStep {
  return reduceWithSteps(day);
}

/**
 * Bhagyank = destiny number from the full date. Summing every digit of the
 * D/M/Y is mathematically identical to reducing each part first and is
 * order-independent, so we sum the lot and reduce once.
 */
export function computeBhagyank(day: number, month: number, year: number): CalcStep {
  const total = sumDigits(day) + sumDigits(month) + sumDigits(year);
  const step = reduceWithSteps(total);
  // Show the source figures in the expression for transparency.
  return {
    ...step,
    expression: `${day} + ${month} + ${year} → ${step.expression}`,
    digits: [
      ...day.toString().split('').map(Number),
      ...month.toString().split('').map(Number),
      ...year.toString().split('').map(Number),
    ],
  };
}

// ─── Planetary friendship → compatibility ────────────────────────────────────
// Directed friend/enemy sets keyed by number, grounded in classical Vedic
// Naisargika (natural) planetary relationships, with Rahu (4) and Ketu (7)
// placed by their conventional numerological affinities. The relation is read
// symmetrically below, so authoring asymmetry here cannot leak out.

const FRIENDS: Record<Digit, Digit[]> = {
  1: [2, 3, 9],
  2: [1, 5],
  3: [1, 2, 9, 7],
  4: [5, 6, 8, 7],
  5: [1, 6],
  6: [5, 8, 4],
  7: [9, 3, 4],
  8: [5, 6, 4],
  9: [1, 2, 3, 7],
};

const ENEMIES: Record<Digit, Digit[]> = {
  1: [6, 8],
  2: [],
  3: [5, 6],
  4: [1, 2],
  5: [2],
  6: [1, 2],
  7: [],
  8: [1, 2, 9],
  9: [5],
};

/** Symmetric relationship between two single digits. self === 'best'. */
export function relationship(a: Digit, b: Digit): CompatRating {
  if (a === b) return 'best';
  const friend = FRIENDS[a].includes(b) || FRIENDS[b].includes(a);
  const enemy = ENEMIES[a].includes(b) || ENEMIES[b].includes(a);
  if (friend && !enemy) return 'friend';
  if (enemy && !friend) return 'challenging';
  return 'neutral';
}

const RATING_NOTE: Record<CompatRating, string> = {
  best: 'Same vibration — instant understanding and shared rhythm.',
  friend: '{a} ({pa}) and {b} ({pb}) energies reinforce each other — a naturally supportive, growth-oriented match.',
  neutral: '{a} ({pa}) and {b} ({pb}) neither clash nor merge — workable with conscious effort and clear communication.',
  challenging: '{a} ({pa}) and {b} ({pb}) pull in different directions — friction is likely unless both make space for the other.',
};

// ─── Number profiles (the encyclopedic layer) ────────────────────────────────

const PROFILES: Record<Digit, NumberProfile> = {
  1: {
    number: 1, planet: 'Sun', sanskritPlanet: 'Surya', element: 'Fire', polarity: 'masculine',
    title: 'The Leader',
    essence: 'Originator, pioneer, and natural authority — the seed from which everything begins.',
    personality:
      'Number 1 carries the Sun’s self-driven, pioneering force. These are independent originators who lead from the front, dislike being told what to do, and feel most alive when starting something of their own. Strong-willed and ambitious, they shine in any role that lets them set the direction.',
    strengths: ['Natural leadership', 'Original, pioneering mind', 'Strong willpower and focus', 'Self-reliant and confident', 'Decisive under pressure'],
    weaknesses: ['Can be dominating or egotistical', 'Impatient with slower people', 'Dislikes criticism', 'Stubborn once set on a path'],
    careers: ['Founder / entrepreneur', 'CEO or department head', 'Government & administration', 'Politics & public leadership', 'Independent professional', 'Pioneering R&D'],
    luckyDays: ['Sunday', 'Monday'], luckyColors: ['Gold', 'Orange', 'Royal Red'],
    gemstone: 'Ruby', altGemstone: 'Red Garnet', metal: 'Gold / Copper',
    deity: 'Surya (Sun God)', mantra: 'Om Ghrini Suryaya Namah', direction: 'East',
    bodyFocus: 'Heart, bones, eyes, circulation',
    healthNote: 'Guard the heart and blood pressure; channel the Sun’s heat through morning exercise and sunlight rather than overwork.',
    remedies: ['Offer water to the rising Sun (Surya Arghya)', 'Wear or carry gold/copper', 'Respect father figures and mentors', 'Recite the Aditya Hridaya Stotra on Sundays'],
  },
  2: {
    number: 2, planet: 'Moon', sanskritPlanet: 'Chandra', element: 'Water', polarity: 'feminine',
    title: 'The Diplomat',
    essence: 'Sensitive, cooperative peacemaker — the one who harmonizes and holds people together.',
    personality:
      'Number 2 reflects the Moon’s gentle, intuitive, emotional nature. These are diplomats and partners, deeply sensitive to mood and atmosphere, gifted at cooperation and mediation. They thrive in twos — supporting, nurturing, and creating harmony rather than competing.',
    strengths: ['Diplomatic and tactful', 'Highly intuitive and empathetic', 'Excellent team player', 'Patient and adaptable', 'Caring and supportive'],
    weaknesses: ['Over-sensitive to criticism', 'Indecisive and hesitant', 'Mood swings', 'Avoids confrontation to a fault'],
    careers: ['Counselling & psychology', 'Hospitality & care', 'Diplomacy & HR', 'Arts, music & poetry', 'Healthcare & nursing', 'Partnership businesses'],
    luckyDays: ['Monday', 'Friday'], luckyColors: ['White', 'Cream', 'Silver', 'Pale Green'],
    gemstone: 'Pearl', altGemstone: 'Moonstone', metal: 'Silver',
    deity: 'Chandra (Moon God)', mantra: 'Om Som Somaya Namah', direction: 'North-West',
    bodyFocus: 'Mind, chest, stomach, fluids',
    healthNote: 'Emotional health is physical health for the 2; protect sleep, hydration, and digestion, and avoid absorbing others’ stress.',
    remedies: ['Offer white flowers/rice on Mondays', 'Keep water by the bedside and stay hydrated', 'Honour the mother and maternal figures', 'Meditate by moonlight or near water'],
  },
  3: {
    number: 3, planet: 'Jupiter', sanskritPlanet: 'Guru (Brihaspati)', element: 'Ether', polarity: 'masculine',
    title: 'The Sage',
    essence: 'Wise, expansive teacher and creator — optimism, knowledge, and joyful expression.',
    personality:
      'Number 3 carries Jupiter’s wisdom, optimism, and expansive cheer. These are teachers, communicators, and creators — disciplined yet joyful, drawn to knowledge, philosophy, and self-expression. Naturally respected, they uplift others and grow through generosity and learning.',
    strengths: ['Wise and knowledgeable', 'Optimistic and inspiring', 'Creative self-expression', 'Disciplined and principled', 'Generous mentor'],
    weaknesses: ['Can be preachy or dogmatic', 'Over-optimistic / over-extends', 'Scatters energy across interests', 'Proud of being right'],
    careers: ['Teaching & academia', 'Writing, media & publishing', 'Law & advisory', 'Finance & banking', 'Spiritual / philosophical work', 'Creative arts'],
    luckyDays: ['Thursday', 'Tuesday'], luckyColors: ['Yellow', 'Gold', 'Saffron'],
    gemstone: 'Yellow Sapphire (Pukhraj)', altGemstone: 'Citrine / Topaz', metal: 'Gold',
    deity: 'Brihaspati / Vishnu', mantra: 'Om Bram Brihaspataye Namah', direction: 'North-East',
    bodyFocus: 'Liver, thighs, fat, arterial system',
    healthNote: 'Jupiter rules expansion — watch weight, liver, and sugar; moderation and movement keep the 3 in balance.',
    remedies: ['Offer to teachers and gurus on Thursdays', 'Wear yellow / saffron', 'Feed and respect Brahmins, teachers, and elders', 'Study scripture or philosophy regularly'],
  },
  4: {
    number: 4, planet: 'Rahu', sanskritPlanet: 'Rahu', element: 'Air', polarity: 'neutral',
    title: 'The Maverick',
    essence: 'Unconventional rebel and builder — sudden change, originality, and outsider insight.',
    personality:
      'Number 4 carries Rahu’s unconventional, rule-bending energy. These are original thinkers and reformers who see what others miss, often living against the grain. Hard-working and resilient, they meet sudden ups and downs and turn instability into innovation.',
    strengths: ['Original, unconventional thinking', 'Hard-working and resilient', 'Sees hidden angles & systems', 'Reform-minded and just', 'Thrives in tech and change'],
    weaknesses: ['Restless and rebellious', 'Prone to sudden upheavals', 'Secretive or misunderstood', 'Can feel like an outsider'],
    careers: ['Technology & engineering', 'Research & analytics', 'Aviation & foreign trade', 'Social reform & activism', 'Stock markets & speculation', 'Unconventional ventures'],
    luckyDays: ['Saturday', 'Sunday'], luckyColors: ['Grey', 'Khaki', 'Electric Blue'],
    gemstone: 'Hessonite (Gomed)', altGemstone: 'Smoky Quartz', metal: 'Mixed / Lead',
    deity: 'Durga / Rahu', mantra: 'Om Raang Rahave Namah', direction: 'South-West',
    bodyFocus: 'Nervous system, skin, feet',
    healthNote: 'Rahu unsettles the nerves; steady routine, grounding, and time off screens calm the 4’s anxious edge.',
    remedies: ['Donate blankets / black sesame on Saturdays', 'Keep a disciplined daily routine', 'Serve the underprivileged and outsiders', 'Practice grounding and breathwork'],
  },
  5: {
    number: 5, planet: 'Mercury', sanskritPlanet: 'Budha', element: 'Earth', polarity: 'neutral',
    title: 'The Communicator',
    essence: 'Versatile, quick-witted networker — freedom, commerce, and the gift of the gab.',
    personality:
      'Number 5 carries Mercury’s agile, versatile mind. These are communicators and traders, quick to learn, restless for variety, and at home in business, travel, and ideas. Youthful and adaptable, they connect people and thrive on freedom and movement.',
    strengths: ['Quick, adaptable intellect', 'Excellent communicator', 'Sharp business sense', 'Versatile and resourceful', 'Friendly and persuasive'],
    weaknesses: ['Restless / easily bored', 'Over-thinks and over-talks', 'Nervous, scattered energy', 'Inconsistent follow-through'],
    careers: ['Business & trading', 'Sales, marketing & PR', 'Writing & journalism', 'Finance & accounting', 'Travel & logistics', 'Tech & analytics'],
    luckyDays: ['Wednesday', 'Friday'], luckyColors: ['Green', 'Turquoise', 'Light Grey'],
    gemstone: 'Emerald (Panna)', altGemstone: 'Green Tourmaline / Peridot', metal: 'Bronze / Brass',
    deity: 'Budha / Vishnu', mantra: 'Om Bum Budhaya Namah', direction: 'North',
    bodyFocus: 'Nervous system, skin, lungs, hands',
    healthNote: 'Mercury rules the nerves and breath; the 5 should manage over-stimulation with stillness, walks in green spaces, and steady sleep.',
    remedies: ['Feed green fodder to cows / green gram on Wednesdays', 'Wear green', 'Honour sisters, daughters, and young people', 'Practice mindful, single-task focus'],
  },
  6: {
    number: 6, planet: 'Venus', sanskritPlanet: 'Shukra', element: 'Water', polarity: 'feminine',
    title: 'The Lover',
    essence: 'Magnetic harmonizer of love and beauty — comfort, art, and devotion to relationships.',
    personality:
      'Number 6 carries Venus’s charm, love of beauty, and devotion to relationships. These are warm, magnetic nurturers drawn to art, comfort, and harmony, who give generously to family and home. Responsible and aesthetic, they make life beautiful for those around them.',
    strengths: ['Loving and devoted', 'Artistic and aesthetic', 'Magnetic, charming presence', 'Responsible and nurturing', 'Creates harmony and comfort'],
    weaknesses: ['Over-attached / possessive', 'Indulgent in luxury & pleasure', 'Self-sacrificing to a fault', 'Avoids hard truths for peace'],
    careers: ['Art, design & fashion', 'Beauty & wellness', 'Hospitality & food', 'Entertainment & media', 'Luxury & lifestyle brands', 'Interior & creative direction'],
    luckyDays: ['Friday', 'Wednesday'], luckyColors: ['White', 'Pink', 'Pastel Blue'],
    gemstone: 'Diamond', altGemstone: 'White Sapphire / Opal', metal: 'Silver / Platinum',
    deity: 'Shukra / Lakshmi', mantra: 'Om Shum Shukraya Namah', direction: 'South-East',
    bodyFocus: 'Reproductive system, kidneys, throat, face',
    healthNote: 'Venus rules indulgence; the 6 should balance rich food and comfort with movement, and protect the kidneys and throat.',
    remedies: ['Offer white sweets / flowers on Fridays', 'Wear white or pink', 'Honour the spouse and women in the family', 'Create beauty and give to the arts'],
  },
  7: {
    number: 7, planet: 'Ketu', sanskritPlanet: 'Ketu', element: 'Water', polarity: 'neutral',
    title: 'The Mystic',
    essence: 'Introspective seeker and researcher — intuition, detachment, and the inner world.',
    personality:
      'Number 7 carries Ketu’s spiritual, introspective depth. These are seekers, analysts, and mystics — intuitive, private, and drawn to the questions beneath the surface. Detached from the material race, they find meaning in research, solitude, and the inner life.',
    strengths: ['Deeply intuitive and spiritual', 'Analytical, research-minded', 'Independent and original', 'Perceptive beneath the surface', 'Calm, philosophical detachment'],
    weaknesses: ['Withdrawn or isolated', 'Over-analyses / over-thinks', 'Hard to know or reach', 'Prone to escapism or doubt'],
    careers: ['Research & science', 'Spirituality & healing', 'Psychology & analysis', 'Writing & philosophy', 'Investigation & forensics', 'Technology & data'],
    luckyDays: ['Monday', 'Sunday'], luckyColors: ['Smoky Grey', 'Light Pastels', 'Sea Green'],
    gemstone: "Cat's Eye (Lehsunia)", altGemstone: 'Chrysoberyl', metal: 'Mixed',
    deity: 'Ganesha / Ketu', mantra: 'Om Kem Ketave Namah', direction: 'South',
    bodyFocus: 'Spine, subtle/nervous system, immunity',
    healthNote: 'Ketu’s energy is subtle and easily depleted; the 7 thrives on rest, meditation, nature, and protecting sensitive nerves and immunity.',
    remedies: ['Worship Ganesha; keep a regular meditation practice', 'Feed dogs and serve ascetics', 'Spend time in nature and solitude', 'Donate multi-coloured blankets'],
  },
  8: {
    number: 8, planet: 'Saturn', sanskritPlanet: 'Shani', element: 'Air', polarity: 'neutral',
    title: 'The Executive',
    essence: 'Disciplined builder of lasting power — karma, endurance, and material mastery.',
    personality:
      'Number 8 carries Saturn’s discipline, endurance, and karmic weight. These are builders and executives who rise slowly but surely through hard work, structure, and patience. Serious and responsible, they earn lasting authority — rewarded in the long run for what they endure early.',
    strengths: ['Disciplined and hard-working', 'Strong organizational power', 'Patient, long-term builder', 'Responsible and just', 'Material and executive mastery'],
    weaknesses: ['Rigid or overly serious', 'Slow rewards / early struggle', 'Can be cold or controlling', 'Carries burdens alone'],
    careers: ['Business & industry', 'Law & justice', 'Real estate & construction', 'Finance & banking', 'Mining, oil & heavy industry', 'Administration & management'],
    luckyDays: ['Saturday', 'Friday'], luckyColors: ['Dark Blue', 'Black', 'Deep Purple'],
    gemstone: 'Blue Sapphire (Neelam)', altGemstone: 'Amethyst / Lapis', metal: 'Iron / Steel',
    deity: 'Shani (Saturn)', mantra: 'Om Sham Shanaischaraya Namah', direction: 'West',
    bodyFocus: 'Bones, teeth, knees, joints',
    healthNote: 'Saturn rules the skeleton; the 8 should protect bones, joints, and knees, and counter Saturn’s heaviness with sunlight and steady exercise.',
    remedies: ['Serve the elderly, labourers, and the poor on Saturdays', 'Light a mustard-oil lamp for Shani', 'Donate iron / black items', 'Practice patience and ethical dealing'],
  },
  9: {
    number: 9, planet: 'Mars', sanskritPlanet: 'Mangal', element: 'Fire', polarity: 'masculine',
    title: 'The Warrior',
    essence: 'Courageous, energetic protector — drive, completion, and fearless action.',
    personality:
      'Number 9 carries Mars’s courage, drive, and fighting spirit. These are warriors and protectors — energetic, determined, and quick to act, with a strong sense of justice. They lead through action and stamina, and at their highest become selfless champions of others.',
    strengths: ['Courageous and energetic', 'Determined and hard-driving', 'Protective and just', 'Action-oriented leader', 'Resilient and brave'],
    weaknesses: ['Quick-tempered / impulsive', 'Aggressive or combative', 'Impatient and restless', 'Burns out by over-doing'],
    careers: ['Defence, police & military', 'Sports & athletics', 'Surgery & medicine', 'Engineering & construction', 'Real estate & land', 'Emergency & rescue services'],
    luckyDays: ['Tuesday', 'Thursday'], luckyColors: ['Red', 'Crimson', 'Scarlet'],
    gemstone: 'Red Coral (Moonga)', altGemstone: 'Carnelian', metal: 'Copper',
    deity: 'Mangal / Hanuman', mantra: 'Om Angarakaya Namah', direction: 'South',
    bodyFocus: 'Blood, muscles, bone marrow, head',
    healthNote: 'Mars rules blood and heat; the 9 should manage anger, accidents, and inflammation, and burn energy through sport rather than conflict.',
    remedies: ['Worship Hanuman; recite Hanuman Chalisa on Tuesdays', 'Wear / offer red', 'Donate to soldiers, athletes, and the injured', 'Channel anger into physical exercise'],
  },
};

const PLANET_BY_NUMBER: Record<Digit, string> = DIGITS.reduce(
  (acc, n) => ({ ...acc, [n]: PROFILES[n].planet }),
  {} as Record<Digit, string>,
);

function compatNote(rating: CompatRating, a: Digit, b: Digit): string {
  return RATING_NOTE[rating]
    .replace('{a}', String(a))
    .replace('{b}', String(b))
    .replace('{pa}', PLANET_BY_NUMBER[a])
    .replace('{pb}', PLANET_BY_NUMBER[b]);
}

function buildCompatibility(mulank: Digit): CompatibilityEntry[] {
  return DIGITS.map((n) => {
    const rating = relationship(mulank, n);
    return { number: n, planet: PLANET_BY_NUMBER[n], rating, note: compatNote(rating, mulank, n) };
  });
}

const RATING_SUMMARY: Record<CompatRating, string> = {
  best: 'in deep harmony with',
  friend: 'naturally supported by',
  neutral: 'balanced and workable with',
  challenging: 'in creative tension with',
};

/**
 * Build the full Mulank reading for a date string (any value `new Date()` can
 * parse; we read the calendar day/month/year). Pure and deterministic.
 */
export function buildMulankReading(dateOfBirth: string): MulankReading {
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid dateOfBirth: ${dateOfBirth}`);
  }
  // Use UTC components so the same calendar date always yields the same numbers
  // regardless of server timezone.
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();

  const mulankStep = computeMulank(day);
  const bhagyankStep = computeBhagyank(day, month, year);
  const mulank = mulankStep.value;
  const bhagyank = bhagyankStep.value;

  const compatibility = buildCompatibility(mulank);
  const bucket = (r: CompatRating) =>
    compatibility.filter((c) => c.rating === r).map((c) => c.number);

  const innerRating = relationship(mulank, bhagyank);
  const innerHarmony = {
    rating: innerRating,
    note:
      mulank === bhagyank
        ? `Your Mulank and Bhagyank are both ${mulank} — a rare, single-pointed focus where who you are and where you’re headed point the same way.`
        : compatNote(innerRating, mulank, bhagyank),
  };

  const mulankProfile = PROFILES[mulank];
  const bhagyankProfile = PROFILES[bhagyank];

  const summary =
    `Your Mulank is ${mulank} (${mulankProfile.planet} — ${mulankProfile.title}) and your Bhagyank is ` +
    `${bhagyank} (${bhagyankProfile.planet} — ${bhagyankProfile.title}). Your instinctive nature is ` +
    `${RATING_SUMMARY[innerRating]} your life path. You connect most easily with numbers ` +
    `${[...bucket('best'), ...bucket('friend')].filter((n) => n !== mulank).join(', ')}.`;

  return {
    dateOfBirth: `${year.toString().padStart(4, '0')}-${month
      .toString()
      .padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
    day,
    month,
    year,
    mulank,
    bhagyank,
    mulankMaster: mulankStep.master,
    bhagyankMaster: bhagyankStep.master,
    calculation: { mulank: mulankStep, bhagyank: bhagyankStep },
    mulankProfile,
    bhagyankProfile,
    innerHarmony,
    compatibility,
    bestMatches: bucket('best'),
    friendlyMatches: bucket('friend'),
    neutralMatches: bucket('neutral'),
    challengingMatches: bucket('challenging'),
    luckyNumbers: [...bucket('best'), ...bucket('friend')],
    summary,
  };
}

export const MULANK_INTERNALS = { FRIENDS, ENEMIES, PROFILES, DIGITS, MASTERS };
