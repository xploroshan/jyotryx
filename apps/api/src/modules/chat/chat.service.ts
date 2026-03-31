import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { OpenAIService } from '../../openai/openai.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  category: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageDto {
  sessionId?: string;
  message: string;
  category?: 'general' | 'kundli' | 'career' | 'relationship' | 'remedy' | 'wealth' | 'health' | 'numerology';
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
    private openaiService: OpenAIService,
    private knowledgeService: KnowledgeService,
  ) {}

  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<{ session: ChatSession; reply: ChatMessage }> {
    const creditCost = this.configService.get<number>('credits.chatCost', 1);

    const deducted = await this.userService.deductCredits(userId, creditCost, 'Chat message');
    if (!deducted) {
      throw new BadRequestException('Insufficient credits. Please purchase more credits to continue.');
    }

    let dbSession;

    if (dto.sessionId) {
      dbSession = await this.prisma.chatSession.findFirst({
        where: { id: dto.sessionId, userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    }

    if (!dbSession) {
      dbSession = await this.prisma.chatSession.create({
        data: {
          userId,
          category: dto.category || 'general',
          title: dto.message.substring(0, 50) + (dto.message.length > 50 ? '...' : ''),
        },
        include: { messages: true },
      });
    }

    // Save user message
    await this.prisma.chatMessage.create({
      data: {
        sessionId: dbSession.id,
        role: 'USER',
        content: dto.message,
      },
    });

    // Fetch user profile for personalized AI responses
    const userProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        dateOfBirth: true,
        timeOfBirth: true,
        placeOfBirth: true,
        gender: true,
      },
    });

    // Generate AI response
    const aiReply = await this.generateAIResponse(
      dto.message,
      dbSession.category,
      dbSession.messages.map((m: any) => ({ role: m.role.toLowerCase(), content: m.content })),
      userProfile,
    );

    // Save assistant message
    const assistantMsg = await this.prisma.chatMessage.create({
      data: {
        sessionId: dbSession.id,
        role: 'ASSISTANT',
        content: aiReply,
      },
    });

    // Build session from data we already have (avoids extra DB query)
    const allMessages = [
      ...dbSession.messages.map((m: any) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role.toLowerCase() as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt.toISOString(),
      })),
      {
        id: 'user-msg-pending',
        sessionId: dbSession.id,
        role: 'user' as const,
        content: dto.message,
        timestamp: new Date().toISOString(),
      },
      {
        id: assistantMsg.id,
        sessionId: assistantMsg.sessionId,
        role: 'assistant' as const,
        content: assistantMsg.content,
        timestamp: assistantMsg.createdAt.toISOString(),
      },
    ];

    const session: ChatSession = {
      id: dbSession.id,
      userId: dbSession.userId,
      title: dbSession.title,
      category: dbSession.category,
      messages: allMessages,
      createdAt: dbSession.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const reply: ChatMessage = {
      id: assistantMsg.id,
      sessionId: assistantMsg.sessionId,
      role: 'assistant',
      content: assistantMsg.content,
      timestamp: assistantMsg.createdAt.toISOString(),
    };

    return { session, reply };
  }

  async getSessions(userId: string): Promise<Omit<ChatSession, 'messages'>[]> {
    const sessions = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return sessions.map((s: any) => ({
      id: s.id,
      userId: s.userId,
      title: s.title,
      category: s.category,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async getSession(userId: string, sessionId: string): Promise<ChatSession> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    return {
      id: session.id,
      userId: session.userId,
      title: session.title,
      category: session.category,
      messages: session.messages.map((m: any) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role.toLowerCase() as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt.toISOString(),
      })),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  private async generateAIResponse(
    message: string,
    category: string,
    history: { role: string; content: string }[],
    userProfile: any,
  ): Promise<string> {
    // Fetch relevant knowledge base context for RAG
    const kbCategory = this.mapCategoryToKB(category);
    const kbResults = await this.knowledgeService.search(message, kbCategory, 5);
    const kbContext = this.knowledgeService.assembleContext(kbResults);

    const systemPrompt = this.getSystemPrompt(category, userProfile);
    const enrichedPrompt = kbContext
      ? `${systemPrompt}\n\nReference Knowledge (use this to ground your responses):\n${kbContext}`
      : systemPrompt;

    const messages = [
      { role: 'system', content: enrichedPrompt },
      ...history.slice(-10).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const result = await this.openaiService.chatCompletion({
      messages,
      maxTokens: 800,
      temperature: 0.7,
    });

    if (result) return result;

    // Fallback: assemble response from knowledge base
    return this.getKBFallbackResponse(message, category, userProfile);
  }

  private mapCategoryToKB(category: string): string | undefined {
    const map: Record<string, string> = {
      kundli: 'planets',
      career: 'houses',
      relationship: 'matching',
      remedy: 'remedies',
      health: 'doshas',
      numerology: 'nakshatras',
      wealth: 'yogas',
    };
    return map[category];
  }

  private async getKBFallbackResponse(message: string, category: string, userProfile: any): Promise<string> {
    // Try to build a response from KB data
    const kbCategory = this.mapCategoryToKB(category);
    const results = kbCategory
      ? await this.knowledgeService.search(message, kbCategory, 3)
      : await this.knowledgeService.search(message, undefined, 3);

    if (results.length > 0) {
      const userName = userProfile?.name || '';
      const greeting = userName ? `${userName}, based on Vedic wisdom:\n\n` : 'Based on Vedic wisdom:\n\n';
      const content = results.map((r) => r.text).join('\n\n');
      return `${greeting}${content}\n\n*Note: For personalized readings, please ensure your birth details are updated in your profile. This guidance is for informational purposes.*`;
    }

    // Final fallback: hardcoded response
    return this.getFallbackResponse(category, userProfile);
  }

  private getSystemPrompt(category: string, userProfile: any): string {
    let profileContext = '';
    if (userProfile) {
      const parts: string[] = [];
      if (userProfile.name) parts.push(`Name: ${userProfile.name}`);
      if (userProfile.dateOfBirth) parts.push(`DOB: ${new Date(userProfile.dateOfBirth).toISOString().split('T')[0]}`);
      if (userProfile.timeOfBirth) parts.push(`Time of Birth: ${userProfile.timeOfBirth}`);
      if (userProfile.placeOfBirth) {
        const place = typeof userProfile.placeOfBirth === 'object' ? userProfile.placeOfBirth.name : userProfile.placeOfBirth;
        if (place) parts.push(`Place of Birth: ${place}`);
      }
      if (userProfile.gender) parts.push(`Gender: ${userProfile.gender}`);

      if (parts.length > 0) {
        profileContext = `\n\nUser's birth details (use these for personalized readings):\n${parts.join('\n')}`;
      }
    }

    const basePrompt = `You are Jyotron, an expert AI Vedic astrologer. You provide insightful, compassionate guidance based on Vedic astrology principles. Always be respectful and positive. Include specific planetary references and Vedic terminology where appropriate. Keep responses concise (2-3 paragraphs). Add a disclaimer that this is for guidance purposes.${profileContext}`;

    const categoryPrompts: Record<string, string> = {
      career: `${basePrompt}\n\nFocus on career guidance, professional growth, Dashamsha chart analysis, and work-related planetary transits. Reference the user's birth chart specifics if available.`,
      relationship: `${basePrompt}\n\nFocus on relationship compatibility, Navamsa chart, Venus placements, 7th house analysis, and love predictions. Personalize based on the user's chart if birth details are available.`,
      kundli: `${basePrompt}\n\nFocus on birth chart interpretation, planetary positions, house analysis, Dasha periods, and Yogas. Use the user's actual birth details for accurate chart reading.`,
      remedy: `${basePrompt}\n\nFocus on astrological remedies: gemstones, mantras, pujas, fasting, and charitable acts. Be specific with instructions. Tailor remedies to the user's chart if birth details are available.`,
      wealth: `${basePrompt}\n\nFocus on financial astrology: 2nd and 11th house analysis, Dhana Yogas, wealth-producing planetary combinations, investment timing, and financial planning based on transits.`,
      health: `${basePrompt}\n\nFocus on medical astrology: 6th and 8th house analysis, planetary influences on health, Ayurvedic constitution, favorable periods for health improvements. Always include a disclaimer that this is not a substitute for medical advice.`,
      numerology: `${basePrompt}\n\nFocus on Vedic and Chaldean numerology: Life Path numbers, Name Numbers, Personal Year cycles, lucky numbers, and practical numerological guidance. Use the user's date of birth for accurate calculations.`,
      general: basePrompt,
    };

    return categoryPrompts[category] || categoryPrompts.general;
  }

  private getFallbackResponse(category: string, userProfile: any): string {
    const userName = userProfile?.name || 'you';
    const hasBirthDetails = userProfile?.dateOfBirth;

    const responses: Record<string, string> = {
      general: hasBirthDetails
        ? `Based on your birth chart analysis, ${userName}, the current planetary alignment suggests a period of growth and transformation. The transit of Jupiter through your chart indicates favorable opportunities. I recommend focusing on new initiatives during this auspicious period.\n\n*Note: For the most accurate personalized readings, I'm analyzing your chart based on your profile birth details.*`
        : `The current planetary alignment suggests a period of positive energy and new opportunities. The stars favor growth and creative pursuits at this time. For a personalized reading based on your specific birth chart, please update your birth details in your profile.\n\n*Note: Add your date of birth, time, and place in your Profile for personalized astrological guidance.*`,
      kundli: hasBirthDetails
        ? `${userName}, analyzing your Kundli based on your birth details, I can see important planetary placements that define your life path. The current Dasha period suggests focusing on personal development and career growth. Would you like me to dive deeper into any specific aspect of your chart?`
        : `For an accurate Kundli reading, I need your birth details. Please update your Date of Birth, Time of Birth, and Place of Birth in your Profile page, and I'll provide personalized chart analysis.`,
      career: hasBirthDetails
        ? `${userName}, the Dashamsha (D10) chart based on your birth details shows promising career indicators. The upcoming planetary transits suggest a significant professional shift. Focus on skill development during this transition period for maximum benefit.`
        : `The current planetary alignments favor professional growth. Saturn's disciplined energy supports long-term career goals. For personalized career guidance based on your Dashamsha chart, please add your birth details to your profile.`,
      relationship: hasBirthDetails
        ? `${userName}, your Navamsa chart reveals important insights about your relationships. Venus's placement suggests deep romantic connections ahead. The 7th lord's position indicates a supportive partnership dynamic in your chart.`
        : `Venus is currently in a favorable transit, bringing positive energy to relationships. For personalized relationship guidance based on your Navamsa chart and Venus placement, please add your birth details to your profile.`,
      remedy: hasBirthDetails
        ? `Based on your planetary positions, ${userName}, I recommend these remedies: Chanting the appropriate Beej Mantra for your chart's most afflicted planet during Brahma Muhurat (4:00-5:30 AM) can bring significant positive changes. Wearing the gemstone suited to your Lagna lord is also beneficial.`
        : `General remedies for the current planetary period include regular meditation, chanting Om Namah Shivaya on Mondays, and practicing gratitude. For personalized remedies based on your specific chart, please add your birth details to your profile.`,
      wealth: `The 2nd and 11th houses in your chart suggest promising financial opportunities. Jupiter's transit through your wealth sector indicates potential gains through investments and career advancement. Consider starting new financial ventures during favorable Muhurat periods.`,
      health: `Your chart indicates strong vitality overall. Regular yoga practice, especially Surya Namaskar, is recommended based on the current planetary period. Please note: astrological health guidance is complementary and should not replace professional medical advice.`,
      numerology: hasBirthDetails
        ? `${userName}, based on your date of birth, your Life Path Number reveals important aspects of your destiny. The current Personal Year cycle suggests a period of growth. I can provide detailed numerological analysis of your name and birth numbers.`
        : `Numerology can reveal powerful insights about your life path and destiny. For accurate numerological calculations, I need your date of birth. Please update your profile with your birth details for personalized numerology readings.`,
    };

    return responses[category] || responses.general;
  }
}
