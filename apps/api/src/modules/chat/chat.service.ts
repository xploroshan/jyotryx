import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, Subscriber } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { OpenAIService } from '../../openai/openai.service';
import { LlmService } from '../../llm/llm.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { ModerationService } from '../../safety/moderation.service';
import { FeatureAccessService } from '../../common/feature-access/feature-access.service';
import { getLocaleInstruction } from '../../common/locale';
import { getAstrologer } from './astrologers';

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

import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
    private openaiService: OpenAIService,
    private llmService: LlmService,
    private knowledgeService: KnowledgeService,
    private moderationService: ModerationService,
    private featureAccess: FeatureAccessService,
  ) {}

  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<{ session: ChatSession; reply: ChatMessage }> {
    const creditCost = this.configService.get<number>('credits.chatCost', 1);

    // Active subscribers (Mode B) chat for free; everyone else spends a
    // credit per message. `charged` gates the refund paths below so we
    // never credit a user we didn't debit.
    const isSubscriber = await this.featureAccess.isActiveSubscriber(userId);
    let charged = false;
    if (!isSubscriber) {
      const deducted = await this.userService.deductCredits(userId, creditCost, 'Chat message');
      if (!deducted) {
        throw new BadRequestException('Insufficient credits. Please purchase more credits to continue.');
      }
      charged = true;
    }

    let dbSession;
    let existingMessages: any[] = [];

    if (dto.sessionId) {
      dbSession = await this.prisma.chatSession.findFirst({
        where: { id: dto.sessionId, userId },
      });
      if (dbSession) {
        existingMessages = await this.prisma.chatMessage.findMany({
          where: { sessionId: dbSession.id },
          orderBy: { createdAt: 'asc' },
        });
      }
    }

    if (!dbSession) {
      // When an astrologer persona is chosen, derive the category from the
      // persona's specialty so KB grounding matches the named astrologer.
      const persona = getAstrologer(dto.astrologerId);
      dbSession = await this.prisma.chatSession.create({
        data: {
          userId,
          category: dto.category || persona?.category || 'general',
          astrologerId: persona?.id ?? null,
          title: dto.message.substring(0, 50) + (dto.message.length > 50 ? '...' : ''),
        },
      });
    }

    // Save user message
    const userMsg = await this.prisma.chatMessage.create({
      data: {
        sessionId: dbSession.id,
        role: 'USER',
        content: dto.message,
      },
    });

    // Non-blocking moderation — fire-and-forget so we don't add a
    // network round-trip to the chat path. ModerationService swallows
    // all errors and only writes a flagged_messages row when OpenAI
    // flags the content. We deliberately don't await.
    this.moderationService.checkAndRecord({
      messageId: userMsg.id,
      userId,
      content: dto.message,
    }).catch(() => { /* logged inside the service */ });

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

    // Generate AI response (refund credit if AI fails entirely)
    let aiReply: string;
    try {
      aiReply = await this.generateAIResponse(
        dto.message,
        dbSession.category,
        existingMessages.map((m: any) => ({ role: m.role.toLowerCase(), content: m.content })),
        userProfile,
        dto.locale,
        userId,
        dbSession.astrologerId,
      );
    } catch (error) {
      this.logger.error('AI response generation failed, refunding credit', error);
      if (charged) {
        await this.userService.addCredits(userId, creditCost, 'CHAT_DEDUCTION', 'Refund: AI response failed');
      }
      throw new BadRequestException('Unable to generate a response. Your credit has been refunded. Please try again.');
    }

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
      ...existingMessages.map((m: any) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role.toLowerCase() as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt.toISOString(),
      })),
      {
        id: userMsg.id,
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

  /**
   * Send a message and stream the AI response as SSE events.
   * Events: token (incremental content), done (completion), error (failure).
   */
  sendMessageStream(
    userId: string,
    dto: SendMessageDto,
  ): Observable<MessageEvent> {
    return new Observable((subscriber: Subscriber<MessageEvent>) => {
      this.handleStream(userId, dto, subscriber).catch((err) => {
        this.logger.error('Stream handler error', err);
        subscriber.next({ data: JSON.stringify({ message: 'Stream failed', refunded: true }) } as MessageEvent);
        subscriber.complete();
      });
    });
  }

  private async handleStream(
    userId: string,
    dto: SendMessageDto,
    subscriber: Subscriber<MessageEvent>,
  ): Promise<void> {
    const creditCost = this.configService.get<number>('credits.chatCost', 1);

    // Subscribers (Mode B) stream for free; everyone else spends a credit.
    const isSubscriber = await this.featureAccess.isActiveSubscriber(userId);
    let charged = false;
    if (!isSubscriber) {
      const deducted = await this.userService.deductCredits(userId, creditCost, 'Chat message');
      if (!deducted) {
        subscriber.next({ data: JSON.stringify({ message: 'Insufficient credits', refunded: false }) } as MessageEvent);
        subscriber.complete();
        return;
      }
      charged = true;
    }

    // Load or create session
    let dbSession;
    let existingMessages: any[] = [];
    if (dto.sessionId) {
      dbSession = await this.prisma.chatSession.findFirst({
        where: { id: dto.sessionId, userId },
      });
      if (dbSession) {
        existingMessages = await this.prisma.chatMessage.findMany({
          where: { sessionId: dbSession.id },
          orderBy: { createdAt: 'asc' },
        });
      }
    }
    if (!dbSession) {
      const persona = getAstrologer(dto.astrologerId);
      dbSession = await this.prisma.chatSession.create({
        data: {
          userId,
          category: dto.category || persona?.category || 'general',
          astrologerId: persona?.id ?? null,
          title: dto.message.substring(0, 50) + (dto.message.length > 50 ? '...' : ''),
        },
      });
    }

    // Save user message (streaming path). We capture the id so the
    // moderation dispatch below can cite it — the same
    // fire-and-forget contract the non-streaming branch uses.
    const userMsg = await this.prisma.chatMessage.create({
      data: { sessionId: dbSession.id, role: 'USER', content: dto.message },
    });
    this.moderationService.checkAndRecord({
      messageId: userMsg.id,
      userId,
      content: dto.message,
    }).catch(() => { /* logged inside the service */ });

    // Fetch user profile + KB context
    const userProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, dateOfBirth: true, timeOfBirth: true, placeOfBirth: true, gender: true },
    });

    const kbCategory = this.mapCategoryToKB(dbSession.category);
    const kbResults = await this.knowledgeService.search(dto.message, kbCategory, 5);
    const kbContext = this.knowledgeService.assembleContext(kbResults);

    const systemPrompt = this.getSystemPrompt(dbSession.category, userProfile, dbSession.astrologerId) + getLocaleInstruction(dto.locale);
    const enrichedPrompt = kbContext
      ? `${systemPrompt}\n\nReference Knowledge (use this to ground your responses):\n${kbContext}`
      : systemPrompt;

    const messages = [
      { role: 'system' as const, content: enrichedPrompt },
      ...existingMessages.slice(-10).map((m: any) => ({
        role: m.role.toLowerCase() === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.content,
      })),
      { role: 'user' as const, content: dto.message },
    ];

    try {
      const stream = await this.llmService.chatCompletionStream({
        messages,
        maxTokens: 800,
        temperature: 0.7,
        model: this.openaiService.getModel(),
      });

      if (!stream) {
        // Fallback: non-streaming response
        const fallback = await this.getKBFallbackResponse(dto.message, dbSession.category, userProfile);
        subscriber.next({ data: JSON.stringify({ content: fallback }) } as MessageEvent);

        const msg = await this.prisma.chatMessage.create({
          data: { sessionId: dbSession.id, role: 'ASSISTANT', content: fallback },
        });
        subscriber.next({ data: JSON.stringify({ messageId: msg.id, sessionId: dbSession.id }) } as MessageEvent);
        subscriber.complete();
        return;
      }

      // Stream tokens
      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk;
        subscriber.next({ data: JSON.stringify({ content: chunk }) } as MessageEvent);
      }

      // Save complete response
      const assistantMsg = await this.prisma.chatMessage.create({
        data: { sessionId: dbSession.id, role: 'ASSISTANT', content: fullContent },
      });

      subscriber.next({ data: JSON.stringify({ messageId: assistantMsg.id, sessionId: dbSession.id }) } as MessageEvent);
      subscriber.complete();
    } catch (error) {
      this.logger.error('Stream generation failed, refunding credit', error);
      if (charged) {
        await this.userService.addCredits(userId, creditCost, 'CHAT_DEDUCTION', 'Refund: Stream failed');
      }
      subscriber.next({ data: JSON.stringify({ message: (error as Error).message, refunded: charged }) } as MessageEvent);
      subscriber.complete();
    }
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
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return {
      id: session.id,
      userId: session.userId,
      title: session.title,
      category: session.category,
      messages: messages.map((m: any) => ({
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
    locale?: string,
    userId?: string,
    astrologerId?: string | null,
  ): Promise<string> {
    // Fetch relevant knowledge base context for RAG
    const kbCategory = this.mapCategoryToKB(category);
    const kbResults = await this.knowledgeService.search(message, kbCategory, 5);
    const kbContext = this.knowledgeService.assembleContext(kbResults);

    const systemPrompt = this.getSystemPrompt(category, userProfile, astrologerId) + getLocaleInstruction(locale);
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
      userId,
      feature: `chat:${category}`,
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

  private getSystemPrompt(category: string, userProfile: any, astrologerId?: string | null): string {
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

    // Build tradition-aware persona based on user's selected astrology traditions
    const traditions: string[] = userProfile?.astrologyTraditions ?? ['VEDIC'];
    let traditionDescriptor: string;
    if (traditions.length === 1) {
      const t = traditions[0];
      traditionDescriptor = t === 'VEDIC' ? 'Vedic astrology'
        : t === 'WESTERN' ? 'Western (tropical) astrology'
        : t === 'CHINESE' ? 'Chinese astrology' : 'Vedic astrology';
    } else {
      const labels = traditions.map(t =>
        t === 'VEDIC' ? 'Vedic' : t === 'WESTERN' ? 'Western' : t === 'CHINESE' ? 'Chinese' : t,
      );
      traditionDescriptor = `${labels.join(', ')} astrology traditions`;
    }

    const multiTraditionNote = traditions.length > 1
      ? ` When the user's question is relevant, provide insights from each tradition you are versed in, and note where they align or differ.`
      : '';

    // When the user is consulting a named astrologer, speak in that
    // astrologer's first-person human voice rather than as a branded AI.
    // The persona never self-identifies as an AI/model so the "Chat with
    // Astrologer" experience reads like a real consultation.
    const persona = getAstrologer(astrologerId);
    const basePrompt = persona
      ? `You are ${persona.name}, a real human astrologer with ${persona.experienceYears} years of experience, specializing in ${persona.specialty} grounded in ${traditionDescriptor}.${multiTraditionNote} Your manner is ${persona.tone}. Speak personally and warmly in the first person, addressing the seeker directly as a practising astrologer would in a one-on-one consultation. Use specific references and terminology from the tradition(s). Keep responses concise (2-3 paragraphs). Never state or imply that you are an AI, a language model, a bot, or a computer program; if asked, simply say you are ${persona.name}. You may gently note that astrological guidance is for reflection, not a substitute for professional advice.${profileContext}`
      : `You are myastro360, an expert AI astrologer versed in ${traditionDescriptor}. You provide insightful, compassionate guidance based on ${traditionDescriptor} principles.${multiTraditionNote} Always be respectful and positive. Include specific references and terminology appropriate to the tradition(s). Keep responses concise (2-3 paragraphs). Add a disclaimer that this is for guidance purposes.${profileContext}`;

    const categoryPrompts: Record<string, string> = {
      career: `${basePrompt}\n\nFocus on career guidance, professional growth, and work-related planetary transits. Reference the user's birth chart specifics if available.`,
      relationship: `${basePrompt}\n\nFocus on relationship compatibility, love predictions, and partnership analysis. Personalize based on the user's chart if birth details are available.`,
      kundli: `${basePrompt}\n\nFocus on birth chart interpretation, planetary positions, house analysis, and key patterns. Use the user's actual birth details for accurate chart reading.`,
      remedy: `${basePrompt}\n\nFocus on astrological remedies appropriate to the tradition(s): gemstones, mantras, elemental balancing, feng shui, or other tradition-specific practices. Be specific with instructions.`,
      wealth: `${basePrompt}\n\nFocus on financial astrology: wealth indicators, prosperity patterns, investment timing, and financial planning based on current transits.`,
      health: `${basePrompt}\n\nFocus on health-related astrology: body-sign associations, planetary health influences, and wellness guidance. Always include a disclaimer that this is not a substitute for medical advice.`,
      numerology: `${basePrompt}\n\nFocus on numerology: Life Path numbers, Name Numbers, Personal Year cycles, lucky numbers, and practical guidance. Use the user's date of birth for accurate calculations.`,
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
