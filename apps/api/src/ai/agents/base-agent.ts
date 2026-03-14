import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface AgentContext {
  userId?: string;
  userName?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  placeOfBirth?: { lat: number; lng: number; name: string };
  zodiacSign?: string;
  chatHistory?: ChatCompletionMessageParam[];
  ragContext?: string;
  [key: string]: unknown;
}

export interface AgentResponse {
  content: string;
  tokensUsed: number;
  model: string;
}

export class BaseAgent {
  protected readonly agentName: string;
  protected readonly systemPrompt: string;
  protected readonly openai: OpenAI;
  protected readonly model: string;

  constructor(
    agentName: string,
    systemPrompt: string,
    model: string = "gpt-4o"
  ) {
    this.agentName = agentName;
    this.systemPrompt = systemPrompt;
    this.model = model;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateResponse(
    userMessage: string,
    context: AgentContext = {}
  ): Promise<AgentResponse> {
    const messages = this.buildMessages(userMessage, context);

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    const choice = completion.choices[0];
    const content = choice?.message?.content ?? "";

    return {
      content,
      tokensUsed: completion.usage?.total_tokens ?? 0,
      model: completion.model,
    };
  }

  protected buildMessages(
    userMessage: string,
    context: AgentContext
  ): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [];

    // System prompt with injected context
    let enrichedSystemPrompt = this.systemPrompt;

    if (context.userName) {
      enrichedSystemPrompt += `\n\nUser's name: ${context.userName}`;
    }
    if (context.dateOfBirth) {
      enrichedSystemPrompt += `\nDate of birth: ${context.dateOfBirth}`;
    }
    if (context.timeOfBirth) {
      enrichedSystemPrompt += `\nTime of birth: ${context.timeOfBirth}`;
    }
    if (context.placeOfBirth) {
      enrichedSystemPrompt += `\nPlace of birth: ${context.placeOfBirth.name} (${context.placeOfBirth.lat}, ${context.placeOfBirth.lng})`;
    }
    if (context.zodiacSign) {
      enrichedSystemPrompt += `\nZodiac sign: ${context.zodiacSign}`;
    }
    if (context.ragContext) {
      enrichedSystemPrompt += `\n\nRelevant astrological knowledge:\n${context.ragContext}`;
    }

    messages.push({ role: "system", content: enrichedSystemPrompt });

    // Append prior chat history if available
    if (context.chatHistory?.length) {
      messages.push(...context.chatHistory);
    }

    messages.push({ role: "user", content: userMessage });

    return messages;
  }

  getName(): string {
    return this.agentName;
  }
}
