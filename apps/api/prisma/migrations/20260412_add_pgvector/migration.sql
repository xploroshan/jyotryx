-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column for embeddings (1536 dimensions = text-embedding-3-small)
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);

-- Create HNSW index for fast approximate nearest neighbor search
-- HNSW provides better recall vs IVFFlat at similar query speeds
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_embedding_vec
ON knowledge_documents
USING hnsw (embedding_vec vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
