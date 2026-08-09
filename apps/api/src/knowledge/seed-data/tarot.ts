/**
 * Tarot Knowledge — spreads, arcana and reading structure.
 * NOTE: must stay exported as TAROT_DATA and imported by prisma/seed.ts;
 * it was orphaned (camelCase, unimported) which left category 'tarot' empty
 * in the DB while tarot.service.ts queried it on every request.
 */
export const TAROT_DATA = [
  {
    text: 'The Major Arcana consists of 22 cards (0-21) representing life\'s spiritual lessons and karmic influences. These cards carry significant weight in a reading and indicate major life events, spiritual growth, and deep archetypal energies. When multiple Major Arcana cards appear, the reading carries extra significance.',
    category: 'tarot',
    topic: 'major_arcana_overview',
    source: 'Traditional Tarot Wisdom',
  },
  {
    text: 'The Minor Arcana consists of 56 cards divided into four suits: Wands (Fire/creativity), Cups (Water/emotions), Swords (Air/intellect), and Pentacles (Earth/material). These represent daily life events, challenges, and opportunities. Court cards (Page, Knight, Queen, King) often represent people or personality aspects.',
    category: 'tarot',
    topic: 'minor_arcana_overview',
    source: 'Traditional Tarot Wisdom',
  },
  {
    text: 'The Three-Card Spread is one of the most versatile tarot layouts. Past-Present-Future reveals the trajectory of a situation. Mind-Body-Spirit shows holistic wellness. Situation-Challenge-Advice offers practical guidance. This spread is ideal for focused questions and daily readings.',
    category: 'tarot',
    topic: 'three_card_spread',
    source: 'Tarot Reading Guide',
  },
  {
    text: 'The Celtic Cross is the most comprehensive standard tarot spread, using 10 cards. Positions: 1-Present, 2-Challenge/Crossing, 3-Foundation/Past, 4-Recent Past, 5-Crown/Best Outcome, 6-Near Future, 7-Self/Attitude, 8-Environment, 9-Hopes and Fears, 10-Final Outcome. This spread provides deep insight into complex situations.',
    category: 'tarot',
    topic: 'celtic_cross',
    source: 'Tarot Reading Guide',
  },
  {
    text: 'Reversed cards in tarot indicate blocked, internalized, or shadow aspects of the upright meaning. They don\'t necessarily mean "bad" — they suggest the energy is turned inward, delayed, or needs attention. A reversed Tower might mean avoiding a crisis; a reversed Star might mean restoring faith slowly.',
    category: 'tarot',
    topic: 'reversed_cards',
    source: 'Modern Tarot Interpretation',
  },
  {
    text: 'In Vedic tradition, tarot aligns with the concept of Karma and cosmic guidance. Each card can be seen as a reflection of planetary energies and karmic patterns. The Fool parallels beginnings like the first house in Jyotish, The Wheel of Fortune echoes the cycles of karma, and The World represents moksha — liberation and completion.',
    category: 'tarot',
    topic: 'vedic_tarot_connection',
    source: 'Vedic Spiritual Traditions',
  },
];
