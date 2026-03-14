import { EmbeddingService } from "../embeddings/embedding-service";
import { KnowledgeBase, SearchResult } from "./knowledge-base";

export interface UserProfile {
  name?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  placeOfBirth?: { lat: number; lng: number; name: string };
  zodiacSign?: string;
  moonSign?: string;
  ascendant?: string;
}

export interface RAGContext {
  documents: SearchResult[];
  assembledPrompt: string;
}

export class RAGPipeline {
  private readonly embeddingService: EmbeddingService;
  private readonly knowledgeBase: KnowledgeBase;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.knowledgeBase = new KnowledgeBase();
  }

  /**
   * Retrieve relevant context documents for a user query.
   */
  async retrieveContext(
    query: string,
    category: string,
    topK: number = 5
  ): Promise<SearchResult[]> {
    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Search the knowledge base with the embedding
    const results = await this.knowledgeBase.search(query, topK, {
      category,
      embedding: queryEmbedding,
    });

    return results;
  }

  /**
   * Assemble a final prompt by combining the user query, retrieved context,
   * and the user's astrological profile.
   */
  assemblePrompt(
    query: string,
    context: SearchResult[],
    userProfile?: UserProfile
  ): string {
    const parts: string[] = [];

    // Add user profile context
    if (userProfile) {
      const profileLines: string[] = ["[User Astrological Profile]"];
      if (userProfile.name) profileLines.push(`Name: ${userProfile.name}`);
      if (userProfile.dateOfBirth) profileLines.push(`Date of Birth: ${userProfile.dateOfBirth}`);
      if (userProfile.timeOfBirth) profileLines.push(`Time of Birth: ${userProfile.timeOfBirth}`);
      if (userProfile.placeOfBirth) profileLines.push(`Place of Birth: ${userProfile.placeOfBirth.name}`);
      if (userProfile.zodiacSign) profileLines.push(`Sun Sign: ${userProfile.zodiacSign}`);
      if (userProfile.moonSign) profileLines.push(`Moon Sign: ${userProfile.moonSign}`);
      if (userProfile.ascendant) profileLines.push(`Ascendant: ${userProfile.ascendant}`);
      parts.push(profileLines.join("\n"));
    }

    // Add retrieved knowledge context
    if (context.length > 0) {
      parts.push("[Relevant Astrological Knowledge]");
      for (const doc of context) {
        const source = doc.metadata?.source ? ` (Source: ${doc.metadata.source})` : "";
        parts.push(`- ${doc.text}${source}`);
      }
    }

    // Add the user query
    parts.push(`\n[User Question]\n${query}`);

    return parts.join("\n\n");
  }

  /**
   * Full RAG flow: retrieve context then assemble prompt.
   */
  async process(
    query: string,
    category: string,
    userProfile?: UserProfile,
    topK: number = 5
  ): Promise<RAGContext> {
    const documents = await this.retrieveContext(query, category, topK);
    const assembledPrompt = this.assemblePrompt(query, documents, userProfile);

    return { documents, assembledPrompt };
  }
}
