import {
  extractTokenUsage,
  truncatePreview,
  AiTraceService,
} from '../../../module/ai-support/services/ai-trace.service';

describe('ai-trace', () => {
  it('truncatePreview cuts long text with marker', () => {
    const long = 'a'.repeat(2100);
    const out = truncatePreview(long, 2000);
    expect(out.length).toBeLessThan(long.length);
    expect(out).toContain('truncated');
  });

  it('extractTokenUsage prefers usage_metadata', () => {
    const u = extractTokenUsage({
      usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      response_metadata: {
        tokenUsage: {
          promptTokens: 99,
          completionTokens: 99,
          totalTokens: 198,
        },
      },
    });
    expect(u).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  it('extractTokenUsage falls back to response_metadata', () => {
    const u = extractTokenUsage({
      response_metadata: {
        tokenUsage: { promptTokens: 7, completionTokens: 3, totalTokens: 10 },
      },
    });
    expect(u?.totalTokens).toBe(10);
  });

  it('extractTokenUsage returns null when no usage', () => {
    expect(extractTokenUsage({})).toBeNull();
  });

  it('AiTraceService.timed measures duration and keeps details', async () => {
    const svc = new AiTraceService();
    const { result, step } = await svc.timed(
      'search_docs',
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        return [1, 2];
      },
      { chunkCount: 2 },
    );
    expect(result).toEqual([1, 2]);
    expect(step.name).toBe('search_docs');
    expect(step.durationMs).toBeGreaterThanOrEqual(0);
    expect(step.chunkCount).toBe(2);
  });
});
