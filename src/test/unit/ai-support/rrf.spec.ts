import { rrfFuse } from '../../../module/ai-support/services/hybrid-retriever.service';
import type { ScoredDoc } from '../../../module/ai-support/services/vector-store.service';

function doc(content: string, source: string): ScoredDoc {
  return { id: content, content, metadata: { source }, score: 0 };
}

describe('rrfFuse (port of simple_agent/hybrid.py)', () => {
  it('fuses dense + sparse, top doc first', () => {
    const dense = [doc('A', 's'), doc('B', 's'), doc('C', 's')];
    const sparse = [doc('B', 's'), doc('D', 's')];
    const fused = rrfFuse([dense, sparse], 60);
    // B appears in both lists -> highest RRF score
    expect(fused[0].content).toBe('B');
    expect(fused.map((d) => d.content)).toEqual(
      expect.arrayContaining(['A', 'B', 'C', 'D']),
    );
  });

  it('dedupes by content+source', () => {
    const dense = [doc('A', 's1')];
    const sparse = [doc('A', 's1'), doc('A', 's2')];
    const fused = rrfFuse([dense, sparse], 60);
    // same content+source counted once; different source kept
    expect(fused.length).toBe(2);
  });
});
