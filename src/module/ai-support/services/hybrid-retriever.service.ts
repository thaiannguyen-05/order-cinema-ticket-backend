import { Injectable, Logger } from '@nestjs/common';
import { Document } from '@langchain/core/documents';
import { BM25Retriever } from '@langchain/community/retrievers/bm25';
import { VectorStoreService, type ScoredDoc } from './vector-store.service';
import { resolveAiConfig } from '../constants';

function docKey(d: {
  content: string;
  metadata: Record<string, unknown>;
}): string {
  const raw = d.metadata?.['source'];
  const src = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
  return `${d.content}||${src}`;
}

/** RRF fuse — port of simple_agent/hybrid.py rrf_fuse. */
export function rrfFuse(rankedLists: ScoredDoc[][], rrfK = 60): ScoredDoc[] {
  const scores = new Map<string, number>();
  const docs = new Map<string, ScoredDoc>();
  for (const list of rankedLists) {
    list.forEach((doc, idx) => {
      const rank = idx + 1;
      const key = docKey(doc);
      scores.set(key, (scores.get(key) ?? 0) + 1 / (rrfK + rank));
      if (!docs.has(key)) docs.set(key, doc);
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => docs.get(key)!);
}

@Injectable()
export class HybridRetrieverService {
  private readonly logger = new Logger(HybridRetrieverService.name);
  private bm25: BM25Retriever | null = null;

  constructor(private readonly vectors: VectorStoreService) {}

  /** Rebuild in-memory BM25 from pgvector corpus (call after ingest / on boot). */
  async refreshBm25(): Promise<void> {
    try {
      const all = await this.vectors.listAllForBm25();
      if (all.length === 0) {
        this.bm25 = null;
        return;
      }
      const docs = all.map(
        (d) =>
          new Document({
            pageContent: d.content,
            metadata: { ...d.metadata, _id: d.id },
          }),
      );
      // BM25Retriever.fromDocuments is sync factory in community build
      this.bm25 = BM25Retriever.fromDocuments(docs, { k: 20 });
    } catch (e) {
      this.logger.warn(`BM25 refresh failed: ${String(e)}`);
      this.bm25 = null;
    }
  }

  /**
   * Dense (pgvector) + sparse (BM25 memory + tsvector) in parallel, fuse RRF.
   * Mirrors diagram steps 5-8 (VectorDB branch).
   */
  async invoke(query: string, topK?: number): Promise<ScoredDoc[]> {
    const cfg = resolveAiConfig();
    const k = Math.min(topK ?? cfg.defaultTopK, cfg.maxTopK);
    const candidateK = cfg.hybridCandidateK;

    const [dense, sparseTsv, sparseBm25] = await Promise.all([
      this.vectors
        .searchDense(query, candidateK)
        .catch(() => [] as ScoredDoc[]),
      this.vectors
        .searchSparse(query, candidateK)
        .catch(() => [] as ScoredDoc[]),
      this.bm25Search(query, candidateK),
    ]);
    this.logger.debug(
      `hybrid dense=${dense.length} tsv=${sparseTsv.length} bm25=${sparseBm25.length}`,
    );
    // Fuse dense + strongest sparse signal (merge tsv + bm25 by content key first)
    const sparseMerged = this.mergeSparse(sparseTsv, sparseBm25);
    const fused = rrfFuse([dense, sparseMerged], cfg.hybridRrfK);
    return fused.slice(0, k);
  }

  private async bm25Search(query: string, k: number): Promise<ScoredDoc[]> {
    if (!this.bm25) return [];
    try {
      const docs = await this.bm25.invoke(query);
      return docs.slice(0, k).map((d, i) => ({
        id: String(d.metadata?._id ?? `bm25-${i}`),
        content: d.pageContent,
        metadata: (d.metadata ?? {}) as Record<string, unknown>,
        score: 1 / (i + 1),
      }));
    } catch {
      return [];
    }
  }

  private mergeSparse(a: ScoredDoc[], b: ScoredDoc[]): ScoredDoc[] {
    const seen = new Map<string, ScoredDoc>();
    for (const d of [...a, ...b]) {
      const key = docKey(d);
      if (!seen.has(key)) seen.set(key, d);
    }
    return [...seen.values()];
  }
}
