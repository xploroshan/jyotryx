export interface LlmChatOptions {
  messages: Array<{ role: string; content: string | any[] }>;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  model?: string;
  userId?: string | null;
  feature?: string;
}

export interface LlmChatResult {
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  model: string;
  provider: string;
}

export interface LlmProvider {
  readonly name: string;

  isAvailable(): boolean;

  chatCompletion(options: LlmChatOptions): Promise<LlmChatResult>;

  chatCompletionStream(options: LlmChatOptions): AsyncIterable<string>;
}
