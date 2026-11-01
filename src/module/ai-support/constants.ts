import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Central config for AI support RAG — mirrors simple_agent/config.py (STEP 0).
// Every key is REQUIRED in .env and read via getOrThrow: fail-fast at boot
// instead of silently running on hidden defaults.
export const AI_CONFIG_KEYS = [
  'AI_CHUNK_SIZE',
  'AI_CHUNK_OVERLAP',
  'AI_RETRIEVER_K',
  'AI_DEFAULT_TOP_K',
  'AI_MAX_TOP_K',
  'AI_MAX_QUERY_CHARS',
  'AI_HYBRID_CANDIDATE_K',
  'AI_HYBRID_RRF_K',
  'AI_LLM_MODEL',
  'AI_LLM_MAX_TOKENS',
  'AI_LLM_TEMPERATURE',
] as const;

export type AiConfig = {
  chunkSize: number;
  chunkOverlap: number;
  retrieverK: number;
  defaultTopK: number;
  maxTopK: number;
  maxQueryChars: number;
  hybridCandidateK: number;
  hybridRrfK: number;
  embeddingDims: number;
  llmModel: string;
  llmMaxTokens: number;
  llmTemperature: number;
};

@Injectable()
export class AiConfigService {
  constructor(private readonly config: ConfigService) {}

  private int(key: string): number {
    const raw = this.config.getOrThrow<string>(key);
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(`Invalid ${key}=${raw}: must be a positive number`);
    }
    return v;
  }

  resolve(): AiConfig {
    return {
      chunkSize: this.int('AI_CHUNK_SIZE'),
      chunkOverlap: this.int('AI_CHUNK_OVERLAP'),
      retrieverK: this.int('AI_RETRIEVER_K'),
      defaultTopK: this.int('AI_DEFAULT_TOP_K'),
      maxTopK: this.int('AI_MAX_TOP_K'),
      maxQueryChars: this.int('AI_MAX_QUERY_CHARS'),
      hybridCandidateK: this.int('AI_HYBRID_CANDIDATE_K'),
      hybridRrfK: this.int('AI_HYBRID_RRF_K'),
      embeddingDims: 1024, // fastembed fast-multilingual-e5-large (code-pinned, must match vector(1024))
      llmModel: this.config.getOrThrow<string>('AI_LLM_MODEL'),
      llmMaxTokens: this.int('AI_LLM_MAX_TOKENS'),
      llmTemperature: Number(
        this.config.getOrThrow<string>('AI_LLM_TEMPERATURE'),
      ),
    };
  }
}
