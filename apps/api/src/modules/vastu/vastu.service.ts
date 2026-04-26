import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { OpenAIService } from '../../openai/openai.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { VastuAnalysisDto } from './dto/vastu-analysis.dto';
import { getLocaleInstruction } from '../../common/locale';

// ─── Vastu Direction Data ──────────────────────────────────────────────────
const DIRECTION_DATA: Record<string, { deity: string; element: string; planet: string; color: string; suitableRooms: string[]; avoid: string[] }> = {
  N: { deity: 'Kubera (God of Wealth)', element: 'Water', planet: 'Mercury', color: 'Green', suitableRooms: ['Living room', 'Treasury', 'Safe room'], avoid: ['Kitchen', 'Toilet', 'Staircase'] },
  NE: { deity: 'Ishana (Lord Shiva)', element: 'Water + Air', planet: 'Jupiter', color: 'Yellow', suitableRooms: ['Puja room', 'Meditation space', 'Water source'], avoid: ['Toilet', 'Kitchen', 'Heavy storage'] },
  E: { deity: 'Indra (King of Gods)', element: 'Fire', planet: 'Sun', color: 'White', suitableRooms: ['Main entrance', 'Study room', 'Bathroom'], avoid: ['Toilet', 'Storeroom'] },
  SE: { deity: 'Agni (God of Fire)', element: 'Fire', planet: 'Venus', color: 'Silver/White', suitableRooms: ['Kitchen', 'Electrical room', 'Generator'], avoid: ['Master bedroom', 'Water tank'] },
  S: { deity: 'Yama (God of Death)', element: 'Earth', planet: 'Mars', color: 'Red/Coral', suitableRooms: ['Bedroom', 'Store room', 'Garage'], avoid: ['Main entrance', 'Puja room'] },
  SW: { deity: 'Nirrti (Goddess of Dissolution)', element: 'Earth', planet: 'Rahu', color: 'Brown', suitableRooms: ['Master bedroom', 'Heavy storage', 'Wardrobe'], avoid: ['Children room', 'Puja room', 'Water tank'] },
  W: { deity: 'Varuna (God of Water)', element: 'Water', planet: 'Saturn', color: 'Blue', suitableRooms: ['Dining room', 'Children room', 'Study'], avoid: ['Main door'] },
  NW: { deity: 'Vayu (God of Wind)', element: 'Air', planet: 'Moon', color: 'White/Grey', suitableRooms: ['Guest room', 'Bathroom', 'Garage'], avoid: ['Master bedroom', 'Puja room'] },
};

const ENTRANCE_SCORES: Record<string, { score: number; verdict: string }> = {
  N: { score: 90, verdict: 'Highly Auspicious' },
  NE: { score: 95, verdict: 'Most Auspicious' },
  E: { score: 85, verdict: 'Auspicious' },
  SE: { score: 50, verdict: 'Moderate — needs remedies' },
  S: { score: 40, verdict: 'Inauspicious — remedies recommended' },
  SW: { score: 30, verdict: 'Inauspicious — strong remedies needed' },
  W: { score: 60, verdict: 'Neutral — acceptable with precautions' },
  NW: { score: 70, verdict: 'Fairly Auspicious' },
};

@Injectable()
export class VastuService {
  private readonly logger = new Logger(VastuService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
    private openaiService: OpenAIService,
    private knowledgeService: KnowledgeService,
  ) {}

  async analyze(userId: string, dto: VastuAnalysisDto) {
    const creditCost = 2;
    return this.userService.deductWithRefund(userId, creditCost, 'Vastu consultation', () =>
      this.runVastuAnalysis(userId, dto),
    );
  }

  private async runVastuAnalysis(userId: string, dto: VastuAnalysisDto) {
    const dirData = DIRECTION_DATA[dto.entranceDirection];
    const entranceScore = ENTRANCE_SCORES[dto.entranceDirection];

    // Build deterministic analysis for all 8 directions
    const directionsAnalysis = Object.entries(DIRECTION_DATA).map(([dir, data]) => ({
      direction: dir,
      deity: data.deity,
      element: data.element,
      planet: data.planet,
      auspiciousColor: data.color,
      suitableRooms: data.suitableRooms,
      avoid: data.avoid,
    }));

    // Entrance-specific recommendations
    const entranceAnalysis = {
      direction: dto.entranceDirection,
      score: entranceScore.score,
      verdict: entranceScore.verdict,
      deity: dirData.deity,
      element: dirData.element,
      suitableFor: dirData.suitableRooms,
      avoid: dirData.avoid,
    };

    // Property-specific tips
    const propertyTips = this.getPropertyTips(dto.propertyType, dto.entranceDirection);

    // Try AI enrichment
    let aiInsights: any = null;
    const client = this.openaiService.getClient();

    const vastuKB = await this.knowledgeService.search(`vastu ${dto.propertyType} ${dto.entranceDirection} ${dto.concern || ''}`, 'vastu', 5);
    const kbContext = vastuKB.length > 0 ? `\n\nReference Knowledge:\n${vastuKB.map(r => r.text).join('\n')}` : '';

    if (client) {
      const model = this.openaiService.getModelForFeature('default');
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: `You are a Vastu Shastra expert. Provide practical, actionable Vastu advice. Return JSON with keys: summary (string), remedies (array of strings), gemstone (string), mantra (string), favorableChanges (array of strings).${kbContext}${getLocaleInstruction(dto.locale)}` },
            { role: 'user', content: `Property: ${dto.propertyType}\nMain entrance: ${dto.entranceDirection}\nConcern: ${dto.concern || 'General Vastu guidance'}\nEntrance score: ${entranceScore.score}/100 (${entranceScore.verdict})` },
          ],
          max_tokens: 800,
          response_format: { type: 'json_object' },
        });
        this.openaiService.recordUsage?.({
          userId,
          feature: 'vastu',
          model,
          usage: completion?.usage,
        });
        const content = completion.choices[0]?.message?.content;
        if (content) aiInsights = JSON.parse(content);
      } catch (error) {
        this.logger.error('AI Vastu analysis failed, using fallback', error);
      }
    }

    if (!aiInsights) {
      aiInsights = this.getFallbackInsights(dto);
    }

    return {
      propertyType: dto.propertyType,
      entrance: entranceAnalysis,
      directions: directionsAnalysis,
      propertyTips,
      insights: aiInsights,
    };
  }

  private getPropertyTips(propertyType: string, entrance: string): string[] {
    const general = [
      'Keep the center (Brahmasthan) of the property open and clutter-free',
      'Place heavy furniture in the South-West direction',
      'Keep the North-East corner clean, light, and sacred',
      'Ensure adequate natural light and ventilation from the East',
      'Avoid mirrors facing the bed in bedrooms',
    ];

    const specific: Record<string, string[]> = {
      house: ['Puja room should be in the North-East', 'Kitchen in the South-East with cooking facing East', 'Master bedroom in the South-West'],
      apartment: ['Ensure balcony or windows face East or North', 'Avoid apartments above a parking lot or shop', 'Keep shoes outside the main entrance'],
      office: ['Owner should sit facing North or East', 'Reception in the North-East', 'Accounts department in the South-East', 'Heavy safes in the South-West'],
      shop: ['Cash counter should face North', 'Main products displayed facing South', 'Entrance should be welcoming and well-lit'],
      factory: ['Heavy machinery in the South-West', 'Raw materials storage in the North-West', 'Finished goods in the South-East', 'Admin block in the East'],
      plot: ['Plot should be square or rectangular', 'North-East should be at the lowest elevation', 'South-West should be at the highest elevation'],
    };

    const entranceRemedies: string[] = [];
    if (['S', 'SW', 'SE'].includes(entrance)) {
      entranceRemedies.push(
        'Place a Vastu pyramid near the entrance',
        'Use bright lighting at the entrance',
        'Place a Swastik or Om symbol on the entrance door',
      );
    }

    return [...general, ...(specific[propertyType] || []), ...entranceRemedies];
  }

  private getFallbackInsights(dto: VastuAnalysisDto) {
    const score = ENTRANCE_SCORES[dto.entranceDirection].score;
    return {
      summary: score >= 80
        ? `Your ${dto.propertyType} has an excellent Vastu placement with the ${dto.entranceDirection} entrance. This direction is governed by ${DIRECTION_DATA[dto.entranceDirection].deity}, bringing positive energy and prosperity.`
        : score >= 60
          ? `Your ${dto.propertyType} has a reasonable Vastu alignment. The ${dto.entranceDirection} entrance is acceptable but can be enhanced with simple remedies.`
          : `Your ${dto.propertyType}'s ${dto.entranceDirection} entrance needs attention. Vastu remedies are recommended to harmonize the energy flow.`,
      remedies: [
        'Place a Vastu Dosh Nivaran Yantra at the entrance',
        `Chant the mantra of ${DIRECTION_DATA[dto.entranceDirection].deity} daily`,
        `Use ${DIRECTION_DATA[dto.entranceDirection].color} color accents near the entrance`,
        'Keep the entrance clean and well-lit',
        'Place fresh flowers or a Tulsi plant near the entrance',
      ],
      gemstone: dto.entranceDirection === 'NE' ? 'Yellow Sapphire (Pukhraj)' : dto.entranceDirection === 'E' ? 'Ruby (Manik)' : 'Pearl (Moti)',
      mantra: `Om ${DIRECTION_DATA[dto.entranceDirection].deity.split(' ')[0]}aya Namah`,
      favorableChanges: [
        'Declutter the entrance area',
        'Add indoor plants in the East and North directions',
        'Use wind chimes in the North-West for positive air flow',
      ],
    };
  }
}
