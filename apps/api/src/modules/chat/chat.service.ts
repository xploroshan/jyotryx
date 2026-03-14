import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';

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
  category?: 'general' | 'kundli' | 'career' | 'relationship' | 'remedy';
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
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
    const userMsg = await this.prisma.chatMessage.create({
      data: {
        sessionId: dbSession.id,
        role: 'USER',
        content: dto.message,
      },
    });

    // Generate AI response
    const aiReply = await this.generateAIResponse(
      dto.message,
      dbSession.category,
      dbSession.messages.map((m) => ({ role: m.role.toLowerCase(), content: m.content })),
    );

    // Save assistant message
    const assistantMsg = await this.prisma.chatMessage.create({
      data: {
        sessionId: dbSession.id,
        role: 'ASSISTANT',
        content: aiReply,
      },
    });

    // Fetch updated session
    const updatedSession = await this.prisma.chatSession.findUnique({
      where: { id: dbSession.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    const session: ChatSession = {
      id: updatedSession!.id,
      userId: updatedSession!.userId,
      title: updatedSession!.title,
      category: updatedSession!.category,
      messages: updatedSession!.messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role.toLowerCase() as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt.toISOString(),
      })),
      createdAt: updatedSession!.createdAt.toISOString(),
      updatedAt: updatedSession!.updatedAt.toISOString(),
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

    return sessions.map((s) => ({
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
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    return {
      id: session.id,
      userId: session.userId,
      title: session.title,
      category: session.category,
      messages: session.messages.map((m) => ({
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
  ): Promise<string> {
    const apiKey = this.configService.get<string>('openai.apiKey');

    if (apiKey) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey });

        const systemPrompt = this.getSystemPrompt(category);
        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-10).map((m) => ({
            role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
            content: m.content,
          })),
          { role: 'user' as const, content: message },
        ];

        const completion = await openai.chat.completions.create({
          model: this.configService.get<string>('openai.model', 'gpt-4o'),
          messages,
          max_tokens: 800,
          temperature: 0.7,
        });

        return completion.choices[0]?.message?.content || 'I apologize, I could not generate a response. Please try again.';
      } catch (error) {
        this.logger.error('OpenAI API call failed, using fallback', error);
      }
    }

    // Fallback responses when no API key is configured
    const responses: Record<string, string> = {
      general:
        'Based on your Vedic chart analysis, the current planetary alignment suggests a period of growth and transformation. The transit of Jupiter through your 10th house indicates favorable opportunities in your professional life. I recommend focusing on new initiatives during this auspicious period.',
      kundli:
        'Your Kundli reveals a strong placement of Moon in the 4th house, indicating emotional depth and strong family bonds. The conjunction of Venus and Mercury in your 7th house suggests harmonious relationships ahead.',
      career:
        'The Dashamsha (D10) chart shows Saturn in the 10th house, indicating disciplined career progression. The upcoming Mahadasha transition suggests a significant career shift in the next 18 months. Focus on skill development during this transition.',
      relationship:
        'Your Navamsa chart indicates Venus in an exalted position, suggesting deep romantic connections. The 7th lord placement suggests a supportive and understanding partner will enter your life soon.',
      remedy:
        'Based on your planetary positions, wearing a Yellow Sapphire (Pukhraj) on the index finger of your right hand on a Thursday morning can strengthen Jupiter\'s influence. Chanting the Guru Beej Mantra "Om Graam Greem Graum Sah Gurave Namah" 108 times daily is also recommended.',
    };

    return responses[category] || responses.general;
  }

  private getSystemPrompt(category: string): string {
    const basePrompt = `You are Jyotryx, an expert AI Vedic astrologer. You provide insightful, compassionate guidance based on Vedic astrology principles. Always be respectful and positive. Include specific planetary references and Vedic terminology where appropriate. Keep responses concise (2-3 paragraphs). Add a disclaimer that this is for guidance purposes.`;

    const categoryPrompts: Record<string, string> = {
      career: `${basePrompt} Focus on career guidance, professional growth, Dashamsha chart analysis, and work-related planetary transits.`,
      relationship: `${basePrompt} Focus on relationship compatibility, Navamsa chart, Venus placements, 7th house analysis, and love predictions.`,
      kundli: `${basePrompt} Focus on birth chart interpretation, planetary positions, house analysis, Dasha periods, and Yogas.`,
      remedy: `${basePrompt} Focus on astrological remedies: gemstones, mantras, pujas, fasting, and charitable acts. Be specific with instructions.`,
      general: basePrompt,
    };

    return categoryPrompts[category] || categoryPrompts.general;
  }
}
