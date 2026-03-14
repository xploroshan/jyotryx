/**
 * Knowledge Base Manager
 *
 * Manages the astrological knowledge documents used by the RAG pipeline.
 * Currently uses an in-memory store as a placeholder; will be replaced
 * with Pinecone vector DB integration.
 */

export interface DocumentMetadata {
  category?: string;
  source?: string;
  language?: string;
  [key: string]: unknown;
}

export interface KnowledgeDocument {
  id: string;
  text: string;
  embedding?: number[];
  metadata: DocumentMetadata;
  createdAt: Date;
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: DocumentMetadata;
}

export interface SearchOptions {
  category?: string;
  embedding?: number[];
}

export class KnowledgeBase {
  // In-memory store — placeholder until Pinecone is integrated
  private documents: KnowledgeDocument[] = [];

  /**
   * Add a document to the knowledge base.
   * In production this will upsert into Pinecone with the embedding vector.
   */
  async addDocument(
    text: string,
    metadata: DocumentMetadata = {},
    embedding?: number[]
  ): Promise<KnowledgeDocument> {
    const doc: KnowledgeDocument = {
      id: this.generateId(),
      text,
      embedding,
      metadata,
      createdAt: new Date(),
    };

    this.documents.push(doc);

    // TODO: Upsert to Pinecone
    // await this.pineconeIndex.upsert([{
    //   id: doc.id,
    //   values: embedding,
    //   metadata: { text, ...metadata },
    // }]);

    return doc;
  }

  /**
   * Add multiple documents in a batch.
   */
  async addDocuments(
    items: Array<{ text: string; metadata?: DocumentMetadata; embedding?: number[] }>
  ): Promise<KnowledgeDocument[]> {
    const docs = await Promise.all(
      items.map((item) => this.addDocument(item.text, item.metadata, item.embedding))
    );
    return docs;
  }

  /**
   * Search the knowledge base for documents relevant to a query.
   *
   * When a Pinecone integration is active, the embedding vector is used for
   * similarity search.  The current placeholder performs a naive text match.
   */
  async search(
    query: string,
    topK: number = 5,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // TODO: Replace with Pinecone vector similarity search
    // const results = await this.pineconeIndex.query({
    //   vector: options.embedding,
    //   topK,
    //   filter: options.category ? { category: options.category } : undefined,
    //   includeMetadata: true,
    // });

    const queryLower = query.toLowerCase();

    let filtered = this.documents;

    // Filter by category if provided
    if (options.category) {
      filtered = filtered.filter((d) => d.metadata.category === options.category);
    }

    // Naive keyword scoring (placeholder for vector similarity)
    const scored: SearchResult[] = filtered.map((doc) => {
      const words = queryLower.split(/\s+/);
      const textLower = doc.text.toLowerCase();
      const matchCount = words.filter((w) => textLower.includes(w)).length;
      const score = words.length > 0 ? matchCount / words.length : 0;

      return {
        id: doc.id,
        text: doc.text,
        score,
        metadata: doc.metadata,
      };
    });

    // Sort by score descending and take topK
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter((r) => r.score > 0);
  }

  /**
   * Delete a document by ID.
   */
  async deleteDocument(id: string): Promise<boolean> {
    const idx = this.documents.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    this.documents.splice(idx, 1);

    // TODO: Delete from Pinecone
    // await this.pineconeIndex.deleteOne(id);

    return true;
  }

  /**
   * Get the total number of documents.
   */
  getDocumentCount(): number {
    return this.documents.length;
  }

  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
