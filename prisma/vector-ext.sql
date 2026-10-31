-- pgvector + hybrid sparse for AI support RAG.
-- Run after `prisma db push` (db push does not manage extensions/indexes).
-- Idempotent: safe to re-run (used by ai:ingest ensure + infra setup).
-- Embedding dim = 1024 (fastembed fast-multilingual-e5-large, multilingual incl. Vietnamese).
-- Ref python simple_agent dùng paraphrase-multilingual-MiniLM-L12-v2 (384 dim, torch ~800MB);
-- JS port dùng fastembed e5-large (onnx nhẹ, đa ngữ tốt hơn cho vi).
-- Nếu đổi model, sửa cả vector(N) dưới + AI_EMBEDDING_DIMS trong code.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- embedding column (Prisma không quản lý vector — managed here, not by db push)
ALTER TABLE support_documents ADD COLUMN IF NOT EXISTS embedding vector(1024);
ALTER TABLE support_documents ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

-- HNSW cosine index (build after data exists; IF NOT EXISTS keeps reruns cheap)
CREATE INDEX IF NOT EXISTS support_documents_embedding_hnsw
  ON support_documents USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS support_documents_search_gin
  ON support_documents USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS support_documents_metadata_gin
  ON support_documents USING GIN (metadata);
