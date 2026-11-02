import {
  computeContextPrecision,
  heuristicPrecision,
  heuristicRecall,
  parseCoverageJson,
  parseRelevanceJson,
  splitClaims,
  tokenize,
} from '../../../module/ai-support/services/rag-eval.service';
import { RagEvalService } from '../../../module/ai-support/services/rag-eval.service';

function svcWith(sampleRate = '1') {
  const llm = { hasKey: () => false } as never;
  const config = {
    get: (k: string, d: string) =>
      k === 'AI_EVAL_SAMPLE_RATE' ? sampleRate : d,
  } as never;
  return new RagEvalService(llm, config);
}

describe('computeContextPrecision (RAGAS rank-weighted)', () => {
  it('all relevant => 1', () => {
    expect(computeContextPrecision([true, true, true])).toBe(1);
  });

  it('none relevant => 0', () => {
    expect(computeContextPrecision([false, false])).toBe(0);
    expect(computeContextPrecision([])).toBe(0);
  });

  it('rewards top rank: [true,false,false] > [false,false,true]', () => {
    const top = computeContextPrecision([true, false, false]);
    const bottom = computeContextPrecision([false, false, true]);
    // RAGAS: 1 relevant -> P@rank/total_relevant. Top rank => 1, bottom => 1/3.
    expect(top).toBeCloseTo(1, 3);
    expect(bottom).toBeCloseTo(1 / 3, 3);
    expect(top).toBeGreaterThan(bottom);
  });

  it('partial: [true,true,false] = (1 + 2/2)/2 = 1? actually (1 + 1)/2', () => {
    // P@1=1, P@2=1 -> (1+1)/2 = 1
    expect(computeContextPrecision([true, true, false])).toBe(1);
  });
});

describe('tokenize/heuristic', () => {
  it('tokenize drops stopwords + short tokens', () => {
    const toks = tokenize('Giá vé của rạp Galaxy là bao nhiêu?');
    expect(toks).toContain('vé');
    expect(toks).toContain('galaxy');
    expect(toks).not.toContain('của');
    expect(toks).not.toContain('là');
  });

  it('heuristicPrecision 1 when chunks share query terms', () => {
    const p = heuristicPrecision('giá vé galaxy', [
      'Giá vé rạp Galaxy theo ShowTime',
      'chính sách hoàn vé rạp galaxy',
    ]);
    expect(p).toBe(1);
  });

  it('heuristicPrecision 0 when no overlap', () => {
    const p = heuristicPrecision('giá vé galaxy', [
      'thời tiết hôm nay nắng đẹp',
      'lập trình python cơ bản',
    ]);
    expect(p).toBe(0);
  });

  it('heuristicRecall 1 for refusal without claims', () => {
    expect(heuristicRecall('Xin lỗi.', ['chunk a'])).toBe(1);
  });

  it('splitClaims splits sentences', () => {
    expect(
      splitClaims(
        'Giá vé rạp Galaxy theo suất chiếu tối nay. Chính sách hoàn vé trong 15 phút.',
      ),
    ).toHaveLength(2);
  });
});

describe('parse helpers', () => {
  it('parseRelevanceJson handles object + array', () => {
    expect(parseRelevanceJson('{"relevant":[1,0,1]}', 3)).toEqual([
      true,
      false,
      true,
    ]);
    expect(parseRelevanceJson('[true, false]', 2)).toEqual([true, false]);
    expect(parseRelevanceJson('nope', 2)).toBeNull();
  });

  it('parseCoverageJson handles claims + covered/total', () => {
    expect(
      parseCoverageJson(
        '{"claims":[{"text":"a","covered":true},{"text":"b","covered":false}]}',
      ),
    ).toEqual({ covered: 1, total: 2 });
    expect(parseCoverageJson('{"covered":2,"total":3}')).toEqual({
      covered: 2,
      total: 3,
    });
    expect(parseCoverageJson('nope')).toBeNull();
  });
});

describe('RagEvalService.shouldEvaluate + evaluate offline', () => {
  it('skips non-RAG paths', async () => {
    const svc = svcWith();
    expect(
      svc.shouldEvaluate({
        intent: 'smalltalk',
        sourceKind: 'none',
        chunks: ['a'],
      }),
    ).toBe(false);
    expect(
      svc.shouldEvaluate({
        intent: 'support',
        sourceKind: 'structured',
        chunks: ['a'],
      }),
    ).toBe(false);
    expect(
      svc.shouldEvaluate({
        intent: 'support',
        sourceKind: 'vector',
        chunks: [],
      }),
    ).toBe(false);
    expect(
      svc.shouldEvaluate({
        intent: 'support',
        sourceKind: 'vector',
        chunks: ['a'],
      }),
    ).toBe(true);
  });

  it('heuristic evaluate when no GROQ key', async () => {
    const svc = svcWith();
    const r = await svc.evaluate({
      query: 'giá vé galaxy',
      chunks: ['Giá vé rạp Galaxy theo ShowTime', 'thời tiết hôm nay'],
      answer: 'Giá vé rạp Galaxy theo ShowTime quy định.',
      intent: 'support',
      sourceKind: 'vector',
      topK: 2,
    });
    expect(r.status).toBe('evaluated');
    expect(r.method).toBe('heuristic');
    expect(r.precision).not.toBeNull();
    expect(r.recall).not.toBeNull();
  });

  it('skipped returns nulls', async () => {
    const svc = svcWith();
    const r = await svc.evaluate({
      query: 'hi',
      chunks: [],
      answer: 'hello',
      intent: 'smalltalk',
      sourceKind: 'none',
      topK: 3,
    });
    expect(r.status).toBe('skipped');
    expect(r.precision).toBeNull();
  });

  it('sampleRate 0 always skips', async () => {
    const svc = svcWith('0');
    const r = await svc.evaluate({
      query: 'giá vé',
      chunks: ['giá vé rạp'],
      answer: 'giá vé rạp đây',
      intent: 'support',
      sourceKind: 'vector',
      topK: 1,
    });
    expect(r.status).toBe('skipped');
  });
});
