import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

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
  category: 'general' | 'kundli' | 'career' | 'relationship' | 'remedy';
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageDto {
  sessionId?: string;
  message: string;
  category?: 'general' | 'kundli' | 'career' | 'relationship' | 'remedy';
}

// In-memory session store for development
const sessionsStore: Map<string, ChatSession> = new Map();

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private configService: ConfigService) {}

  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<{ session: ChatSession; reply: ChatMessage }> {
    const creditCost = this.configService.get<number>('credits.chatCost', 1);
    // TODO: Check and deduct user credits via UserService

    let session: ChatSession;

    if (dto.sessionId && sessionsStore.has(dto.sessionId)) {
      session = sessionsStore.get(dto.sessionId)!;
    } else {
      session = {
        id: dto.sessionId || uuidv4(),
        userId,
        title: dto.message.substring(0, 50) + (dto.message.length > 50 ? '...' : ''),
        category: dto.category || 'general',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      sessionId: session.id,
      role: 'user',
      content: dto.message,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMessage);

    // TODO: Replace with actual AI/LangChain call
    const aiReply = await this.generateAIResponse(dto.message, session.category);

    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      sessionId: session.id,
      role: 'assistant',
      content: aiReply,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(assistantMessage);
    session.updatedAt = new Date().toISOString();

    sessionsStore.set(session.id, session);
    this.logger.log(`Chat message processed for session: ${session.id}`);

    return { session, reply: assistantMessage };
  }

  async getSessions(userId: string): Promise<Omit<ChatSession, 'messages'>[]> {
    // TODO: Replace with Prisma query
    const userSessions = Array.from(sessionsStore.values())
      .filter((s) => s.userId === userId)
      .map(({ messages, ...rest }) => rest)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return userSessions;
  }

  async getSession(userId: string, sessionId: string): Promise<ChatSession> {
    // TODO: Replace with Prisma query
    const session = sessionsStore.get(sessionId);

    if (!session || session.userId !== userId) {
      throw new BadRequestException('Session not found');
    }

    return session;
  }

  private async generateAIResponse(
    message: string,
    category: string,
  ): Promise<string> {
    // TODO: Integrate LangChain / OpenAI agent pipeline
    // This is placeholder logic for development
    const responses: Record<string, string> = {
      general:
        'Based on your Vedic chart analysis, the current planetary alignment suggests a period of growth and transformation. The transit of Jupiter through your 10th house indicates favorable opportunities in your professional life.',
      kundli:
        'Your Kundli reveals a strong placement of Moon in the 4th house, indicating emotional depth and strong family bonds. The conjunction of Venus and Mercury in your 7th house suggests harmonious relationships.',
      career:
        'The Dashamsha (D10) chart shows Saturn in the 10th house, indicating disciplined career progression. The upcoming Mahadasha transition suggests a significant career shift in the next 18 months.',
      relationship:
        'Your Navamsa chart indicates Venus in an exalted position, suggesting deep romantic connections. The 7th lord placement suggests a supportive and understanding partner.',
      remedy:
        'Based on your planetary positions, wearing a Yellow Sapphire (Pukhraj) on the index finger of your right hand on a Thursday morning can strengthen Jupiter\'s influence. Chanting the Guru Beej Mantra "Om Graam Greem Graum Sah Gurave Namah" 108 times daily is also recommended.',
    };

    return responses[category] || responses.general;
  }
}
