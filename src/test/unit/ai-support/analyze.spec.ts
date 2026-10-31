import { ToolsService } from '../../../module/ai-support/services/tools.service';
import { resolveAiConfig } from '../../../module/ai-support/constants';

describe('analyze_query (tool 1)', () => {
  const svc = new ToolsService(
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
  );

  it('trims and collapses whitespace', () => {
    const r = svc.analyzeQuery('  phim   Dune  ');
    expect(r.cleaned).toBe('phim Dune');
    expect(r.truncated).toBe(false);
  });

  it('truncates over MAX_QUERY_CHARS', () => {
    const cfg = resolveAiConfig();
    const long = 'a'.repeat(cfg.maxQueryChars + 10);
    const r = svc.analyzeQuery(long);
    expect(r.cleaned.length).toBe(cfg.maxQueryChars);
    expect(r.truncated).toBe(true);
  });
});
