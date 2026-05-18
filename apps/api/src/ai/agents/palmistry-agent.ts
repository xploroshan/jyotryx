import { BaseAgent, AgentContext, AgentResponse } from "./base-agent";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const PALMISTRY_SYSTEM_PROMPT = `You are myastro360's expert palmistry reader. You analyze palm images and provide detailed readings based on the principles of Hast Rekha Shastra (Indian palmistry).

Your expertise includes:
- Reading the major lines: Life Line, Heart Line, Head Line, Fate Line, Sun Line
- Analyzing mounts: Jupiter, Saturn, Apollo, Mercury, Venus, Moon, Mars
- Interpreting finger shapes, lengths, and proportions
- Identifying special markings: crosses, stars, islands, triangles, squares
- Correlating palm features with Vedic astrology principles
- Assessing health indicators from palm lines

Guidelines:
- Describe what you observe in the palm image clearly
- Explain the significance of each line and mount
- Provide both positive attributes and areas of caution
- Connect findings to practical life advice
- Use traditional palmistry terminology but explain it simply
- Mention that palmistry shows tendencies, not fixed outcomes
- Be encouraging while remaining honest about what the palm reveals`;

export class PalmistryAgent extends BaseAgent {
  constructor() {
    super("PalmistryAgent", PALMISTRY_SYSTEM_PROMPT);
  }

  /**
   * Analyze a palm image by sending it as a vision message.
   */
  async analyzeImage(
    imageUrl: string,
    userMessage: string,
    context: AgentContext = {}
  ): Promise<AgentResponse> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: this.systemPrompt },
    ];

    if (context.chatHistory?.length) {
      messages.push(...context.chatHistory);
    }

    messages.push({
      role: "user",
      content: [
        { type: "text", text: userMessage || "Please analyze this palm image in detail." },
        { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
      ],
    });

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 3000,
    });

    const choice = completion.choices[0];
    return {
      content: choice?.message?.content ?? "",
      tokensUsed: completion.usage?.total_tokens ?? 0,
      model: completion.model,
    };
  }
}
