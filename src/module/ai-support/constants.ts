// Central config for AI support RAG — mirrors simple_agent/config.py (STEP 0).
export const AI_CONFIG = {
  chunkSize: 500,
  chunkOverlap: 50,
  retrieverK: 10,
  defaultTopK: 3,
  maxTopK: 10,
  maxQueryChars: 1000,
  hybridCandidateK: 20,
  hybridRrfK: 60,
  embeddingDims: 1024, // fastembed fast-multilingual-e5-large
  llmModel: 'qwen/qwen3.8-27b',
  llmMaxTokens: 256,
  llmTemperature: 0.5,
} as const;

export function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = parseInt(raw, 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function resolveAiConfig() {
  return {
    chunkSize: getEnvInt('AI_CHUNK_SIZE', AI_CONFIG.chunkSize),
    chunkOverlap: getEnvInt('AI_CHUNK_OVERLAP', AI_CONFIG.chunkOverlap),
    retrieverK: getEnvInt('AI_RETRIEVER_K', AI_CONFIG.retrieverK),
    defaultTopK: getEnvInt('AI_DEFAULT_TOP_K', AI_CONFIG.defaultTopK),
    maxTopK: getEnvInt('AI_MAX_TOP_K', AI_CONFIG.maxTopK),
    maxQueryChars: getEnvInt('AI_MAX_QUERY_CHARS', AI_CONFIG.maxQueryChars),
    hybridCandidateK: getEnvInt(
      'AI_HYBRID_CANDIDATE_K',
      AI_CONFIG.hybridCandidateK,
    ),
    hybridRrfK: getEnvInt('AI_HYBRID_RRF_K', AI_CONFIG.hybridRrfK),
    embeddingDims: AI_CONFIG.embeddingDims,
    llmModel: process.env.AI_LLM_MODEL || AI_CONFIG.llmModel,
    llmMaxTokens: getEnvInt('AI_LLM_MAX_TOKENS', AI_CONFIG.llmMaxTokens),
    llmTemperature: Number(
      process.env.AI_LLM_TEMPERATURE ?? AI_CONFIG.llmTemperature,
    ),
  };
}
