import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider, LlmChatOptions, LlmChatResult } from './llm-provider.interface';

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private client: any = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('gemini.apiKey');
    if (apiKey) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        this.client = new GoogleGenAI({ apiKey });
      } catch {
        this.client = null;
      }
    }
  }

  isAvailable(): boolean {
    return this.client != null;
  }

  async chatCompletion(options: LlmChatOptions): Promise<LlmChatResult> {
    if (!this.client) throw new Error('Gemini client not available');

    const model = this.mapModel(options.model);

    // Build Gemini contents from OpenAI-style messages
    let systemInstruction: string | undefined;
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of options.messages) {
      const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (msg.role === 'system') {
        systemInstruction = systemInstruction ? `${systemInstruction}\n${text}` : text;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text }],
        });
      }
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Please respond.' }] });
    }

    const config: Record<string, any> = {
      maxOutputTokens: options.maxTokens ?? 1500,
      temperature: options.temperature ?? 0.7,
    };

    if (options.jsonMode) {
      config.responseMimeType = 'application/json';
    }

    const response = await this.client.models.generateContent({
      model,
      contents,
      config: {
        ...config,
        ...(systemInstruction && { systemInstruction }),
      },
    });

    const content = response.text ?? '';
    const usage = response.usageMetadata;

    return {
      content,
      usage: {
        prompt_tokens: usage?.promptTokenCount,
        completion_tokens: usage?.candidatesTokenCount,
        total_tokens: usage?.totalTokenCount,
      },
      model,
      provider: this.name,
    };
  }

  async *chatCompletionStream(options: LlmChatOptions): AsyncIterable<string> {
    if (!this.client) throw new Error('Gemini client not available');

    const model = this.mapModel(options.model);

    let systemInstruction: string | undefined;
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of options.messages) {
      const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (msg.role === 'system') {
        systemInstruction = systemInstruction ? `${systemInstruction}\n${text}` : text;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text }],
        });
      }
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Please respond.' }] });
    }

    const config: Record<string, any> = {
      maxOutputTokens: options.maxTokens ?? 1500,
      temperature: options.temperature ?? 0.7,
    };

    const response = await this.client.models.generateContentStream({
      model,
      contents,
      config: {
        ...config,
        ...(systemInstruction && { systemInstruction }),
      },
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) yield text;
    }
  }

  private mapModel(openaiModel?: string): string {
    const defaultModel = this.configService.get<string>('gemini.model', 'gemini-2.0-flash');
    if (!openaiModel) return defaultModel;

    const map: Record<string, string> = {
      'gpt-4o': 'gemini-2.0-flash',
      'gpt-4o-mini': 'gemini-2.0-flash',
      'gpt-4-turbo': 'gemini-2.0-flash',
      'gpt-4': 'gemini-2.0-flash',
      'gpt-3.5-turbo': 'gemini-2.0-flash',
    };
    return map[openaiModel] || defaultModel;
  }
}
