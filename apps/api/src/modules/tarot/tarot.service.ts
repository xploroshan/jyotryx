import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { OpenAIService } from '../../openai/openai.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { DrawCardsDto } from './dto/draw-cards.dto';
import { getLocaleInstruction } from '../../common/locale';

// ─── 78-Card Tarot Deck ────────────────────────────────────────────────────
const MAJOR_ARCANA = [
  { name: 'The Fool', number: 0, meaning: 'New beginnings, innocence, spontaneity, free spirit', reversed: 'Recklessness, taken advantage of, inconsideration' },
  { name: 'The Magician', number: 1, meaning: 'Willpower, desire, creation, manifestation', reversed: 'Trickery, illusions, out of touch' },
  { name: 'The High Priestess', number: 2, meaning: 'Intuition, sacred knowledge, divine feminine, the subconscious mind', reversed: 'Secrets, disconnected from intuition, withdrawal' },
  { name: 'The Empress', number: 3, meaning: 'Femininity, beauty, nature, nurturing, abundance', reversed: 'Creative block, dependence on others' },
  { name: 'The Emperor', number: 4, meaning: 'Authority, establishment, structure, father figure', reversed: 'Domination, excessive control, lack of discipline' },
  { name: 'The Hierophant', number: 5, meaning: 'Spiritual wisdom, religious beliefs, conformity, tradition', reversed: 'Personal beliefs, freedom, challenging the status quo' },
  { name: 'The Lovers', number: 6, meaning: 'Love, harmony, relationships, values alignment', reversed: 'Self-love, disharmony, imbalance' },
  { name: 'The Chariot', number: 7, meaning: 'Control, willpower, success, action, determination', reversed: 'Self-discipline, opposition, lack of direction' },
  { name: 'Strength', number: 8, meaning: 'Strength, courage, persuasion, influence, compassion', reversed: 'Inner strength, self-doubt, low energy' },
  { name: 'The Hermit', number: 9, meaning: 'Soul-searching, introspection, being alone, inner guidance', reversed: 'Isolation, loneliness, withdrawal' },
  { name: 'Wheel of Fortune', number: 10, meaning: 'Good luck, karma, life cycles, destiny, turning point', reversed: 'Bad luck, resistance to change, breaking cycles' },
  { name: 'Justice', number: 11, meaning: 'Justice, fairness, truth, cause and effect, law', reversed: 'Unfairness, lack of accountability, dishonesty' },
  { name: 'The Hanged Man', number: 12, meaning: 'Pause, surrender, letting go, new perspectives', reversed: 'Delays, resistance, stalling, indecision' },
  { name: 'Death', number: 13, meaning: 'Endings, change, transformation, transition', reversed: 'Resistance to change, personal transformation, inner purging' },
  { name: 'Temperance', number: 14, meaning: 'Balance, moderation, patience, purpose', reversed: 'Imbalance, excess, self-healing, realignment' },
  { name: 'The Devil', number: 15, meaning: 'Shadow self, attachment, addiction, restriction', reversed: 'Releasing limiting beliefs, exploring dark thoughts' },
  { name: 'The Tower', number: 16, meaning: 'Sudden change, upheaval, chaos, revelation, awakening', reversed: 'Personal transformation, fear of change, averting disaster' },
  { name: 'The Star', number: 17, meaning: 'Hope, faith, purpose, renewal, spirituality', reversed: 'Lack of faith, despair, self-trust, disconnection' },
  { name: 'The Moon', number: 18, meaning: 'Illusion, fear, anxiety, subconscious, intuition', reversed: 'Release of fear, repressed emotion, inner confusion' },
  { name: 'The Sun', number: 19, meaning: 'Positivity, fun, warmth, success, vitality', reversed: 'Inner child, feeling down, overly optimistic' },
  { name: 'Judgement', number: 20, meaning: 'Judgement, rebirth, inner calling, absolution', reversed: 'Self-doubt, inner critic, ignoring the call' },
  { name: 'The World', number: 21, meaning: 'Completion, integration, accomplishment, travel', reversed: 'Seeking personal closure, short-cuts, delays' },
];

const SUITS = ['Wands', 'Cups', 'Swords', 'Pentacles'];
const COURT_CARDS = ['Page', 'Knight', 'Queen', 'King'];
const SUIT_MEANINGS: Record<string, { theme: string; element: string }> = {
  Wands: { theme: 'creativity, energy, passion, action', element: 'Fire' },
  Cups: { theme: 'emotions, feelings, relationships, intuition', element: 'Water' },
  Swords: { theme: 'intellect, thought, communication, conflict', element: 'Air' },
  Pentacles: { theme: 'material, financial, career, physical', element: 'Earth' },
};

function buildMinorArcana() {
  const cards: { name: string; suit: string; number: number; meaning: string; reversed: string }[] = [];
  for (const suit of SUITS) {
    for (let i = 1; i <= 10; i++) {
      cards.push({
        name: `${i === 1 ? 'Ace' : i} of ${suit}`,
        suit,
        number: i,
        meaning: `${SUIT_MEANINGS[suit].theme} — energy of ${i}`,
        reversed: `Blocked ${SUIT_MEANINGS[suit].element.toLowerCase()} energy`,
      });
    }
    for (const court of COURT_CARDS) {
      cards.push({
        name: `${court} of ${suit}`,
        suit,
        number: COURT_CARDS.indexOf(court) + 11,
        meaning: `${court} energy in ${SUIT_MEANINGS[suit].theme}`,
        reversed: `Shadow ${court.toLowerCase()} qualities in ${SUIT_MEANINGS[suit].element.toLowerCase()}`,
      });
    }
  }
  return cards;
}

const FULL_DECK = [
  ...MAJOR_ARCANA.map(c => ({ ...c, arcana: 'major' as const, suit: null })),
  ...buildMinorArcana().map(c => ({ ...c, arcana: 'minor' as const })),
];

const SPREAD_CONFIG: Record<string, { count: number; positions: string[]; credits: number }> = {
  single: { count: 1, positions: ['Present Situation'], credits: 1 },
  'three-card': { count: 3, positions: ['Past', 'Present', 'Future'], credits: 2 },
  'celtic-cross': { count: 10, positions: ['Present', 'Challenge', 'Past', 'Future', 'Above', 'Below', 'Advice', 'External Influences', 'Hopes & Fears', 'Outcome'], credits: 3 },
};

@Injectable()
export class TarotService {
  private readonly logger = new Logger(TarotService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
    private openaiService: OpenAIService,
    private knowledgeService: KnowledgeService,
  ) {}

  async drawCards(userId: string, dto: DrawCardsDto) {
    const config = SPREAD_CONFIG[dto.spread];
    if (!config) throw new BadRequestException('Invalid spread type. Use: single, three-card, or celtic-cross');

    return this.userService.deductWithRefund(userId, config.credits, `Tarot ${dto.spread} reading`, () =>
      this.runTarotDraw(userId, dto, config),
    );
  }

  private async runTarotDraw(userId: string, dto: DrawCardsDto, config: typeof SPREAD_CONFIG[keyof typeof SPREAD_CONFIG]) {
    // Shuffle and draw
    const shuffled = [...FULL_DECK].sort(() => Math.random() - 0.5);
    const drawn = shuffled.slice(0, config.count).map((card, i) => ({
      ...card,
      position: config.positions[i],
      isReversed: Math.random() > 0.5,
    }));

    // Generate interpretation
    let interpretation: any;
    const client = this.openaiService.getClient();

    const tarotKB = await this.knowledgeService.search(`tarot ${dto.spread} ${dto.question || 'reading'}`, 'tarot', 5);
    const kbContext = tarotKB.length > 0 ? `\n\nReference Knowledge:\n${tarotKB.map(r => r.text).join('\n')}` : '';

    if (client) {
      const model = this.openaiService.getModelForFeature('default');
      try {
        const cardsDesc = drawn.map(c => `${c.position}: ${c.name}${c.isReversed ? ' (Reversed)' : ''}`).join('\n');
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: `You are a wise and compassionate tarot reader rooted in Vedic spiritual tradition. Provide insightful, empathetic interpretations. Return JSON with keys: overall (string), cardInterpretations (array of {card, position, meaning}), advice (string), spiritualGuidance (string).${kbContext}${getLocaleInstruction(dto.locale)}` },
            { role: 'user', content: `Spread: ${dto.spread}\nQuestion: ${dto.question || 'General guidance'}\nCards drawn:\n${cardsDesc}` },
          ],
          max_tokens: 1200,
          response_format: { type: 'json_object' },
        });
        this.openaiService.recordUsage?.({
          userId,
          feature: `tarot:${dto.spread}`,
          model,
          usage: completion?.usage,
        });
        const content = completion.choices[0]?.message?.content;
        if (content) interpretation = JSON.parse(content);
      } catch (error) {
        this.logger.error('AI tarot interpretation failed, using fallback', error);
      }
    }

    if (!interpretation) {
      interpretation = this.getFallbackInterpretation(drawn, dto.question);
    }

    // Save to database
    const reading = await this.prisma.tarotReading.create({
      data: {
        userId,
        spread: dto.spread,
        cards: drawn as any,
        interpretation: interpretation as any,
      },
    });

    return {
      id: reading.id,
      spread: dto.spread,
      cards: drawn,
      interpretation,
      createdAt: reading.createdAt.toISOString(),
    };
  }

  private getFallbackInterpretation(cards: any[], question?: string) {
    const cardInterpretations = cards.map(c => ({
      card: c.name,
      position: c.position,
      meaning: c.isReversed ? (c.reversed || 'Reversed energy — reflect on internal blocks') : (c.meaning || 'Upright energy — embrace this quality'),
    }));

    const majorCount = cards.filter(c => c.arcana === 'major').length;
    const reversedCount = cards.filter(c => c.isReversed).length;

    return {
      overall: majorCount > cards.length / 2
        ? 'Major Arcana cards dominate this spread, indicating significant life events and karmic forces at play. The universe is sending powerful messages.'
        : reversedCount > cards.length / 2
          ? 'Several reversed cards suggest a period of introspection and inner work. Look within for answers before taking external action.'
          : 'A balanced spread with a mix of energies. The cards suggest a period of steady growth and the importance of maintaining equilibrium.',
      cardInterpretations,
      advice: 'Trust your intuition and remain open to the guidance the universe is offering. Meditate on these cards and let their wisdom unfold naturally.',
      spiritualGuidance: 'Om Shanti. The divine light within you knows the path. Trust in the cosmic order and let karma guide your steps.',
    };
  }

  async getHistory(userId: string) {
    const readings = await this.prisma.tarotReading.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return readings.map((r: any) => ({
      id: r.id,
      spread: r.spread,
      cards: r.cards,
      interpretation: r.interpretation,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
