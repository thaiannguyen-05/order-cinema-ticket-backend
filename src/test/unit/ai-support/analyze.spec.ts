import { ToolsService } from '../../../module/ai-support/services/tools.service';
import { AiConfigService } from '../../../module/ai-support/constants';

const stubConfig = {
  getOrThrow: (key: string) => {
    const vals: Record<string, string> = {
      AI_CHUNK_SIZE: '500',
      AI_CHUNK_OVERLAP: '50',
      AI_RETRIEVER_K: '10',
      AI_DEFAULT_TOP_K: '3',
      AI_MAX_TOP_K: '10',
      AI_MAX_QUERY_CHARS: '1000',
      AI_HYBRID_CANDIDATE_K: '20',
      AI_HYBRID_RRF_K: '60',
      AI_LLM_MODEL: 'qwen/qwen3.8-27b',
      AI_LLM_MAX_TOKENS: '256',
      AI_LLM_TEMPERATURE: '0.5',
    };
    if (!(key in vals)) throw new Error(`Missing ${key}`);
    return vals[key];
  },
} as never;

describe('analyze_query (tool 1)', () => {
  const aiConfig = new AiConfigService(stubConfig);
  const svc = new ToolsService(
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    aiConfig,
  );

  it('trims and collapses whitespace', () => {
    const r = svc.analyzeQuery('  phim   Dune  ');
    expect(r.cleaned).toBe('phim Dune');
    expect(r.truncated).toBe(false);
  });

  it('truncates over MAX_QUERY_CHARS', () => {
    const cfg = aiConfig.resolve();
    const long = 'a'.repeat(cfg.maxQueryChars + 10);
    const r = svc.analyzeQuery(long);
    expect(r.cleaned.length).toBe(cfg.maxQueryChars);
    expect(r.truncated).toBe(true);
  });
});
