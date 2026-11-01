import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { EmbeddingsService } from './embeddings.service';
import { AiConfigService } from '../constants';

export type ScoredDoc = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
};

type RawRow = { id: string; content: string; metadata: string; score: number };

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

@Injectable()
export class VectorStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly aiConfig: AiConfigService,
  ) {}

  /** Dense cosine search on pgvector (step 6 Dense + step 7-8 in diagram). */
  async searchDense(query: string, k: number): Promise<ScoredDoc[]> {
    const cfg = this.aiConfig.resolve();
    const topK = Math.min(k, cfg.maxTopK);
    const vec = await this.embeddings.embedQuery(query);
    const lit = toVectorLiteral(vec);
    const rows = await this.prisma.$queryRaw<RawRow[]>`
      SELECT id::text AS id, content, COALESCE(metadata, '{}'::jsonb)::text AS metadata,
              1 - (embedding <=> ${lit}::vector) AS score
         FROM support_documents
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${lit}::vector
        LIMIT ${topK}`;
    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      metadata: this.safeMeta(r.metadata),
      score: Number(r.score),
    }));
  }

  /** Sparse lexical search via tsvector (phase-2 counterpart of BM25). */
  async searchSparse(query: string, k: number): Promise<ScoredDoc[]> {
    const cfg = this.aiConfig.resolve();
    const topK = Math.min(k, cfg.maxTopK);
    try {
      const rows = await this.prisma.$queryRaw<RawRow[]>`
        SELECT id::text AS id, content, COALESCE(metadata, '{}'::jsonb)::text AS metadata,
                ts_rank(search_tsv, plainto_tsquery('simple', ${query})) AS score
           FROM support_documents
          WHERE search_tsv @@ plainto_tsquery('simple', ${query})
          ORDER BY score DESC
          LIMIT ${topK}`;
      return rows.map((r) => ({
        id: r.id,
        content: r.content,
        metadata: this.safeMeta(r.metadata),
        score: Number(r.score),
      }));
    } catch {
      return [];
    }
  }

  async listAllForBm25(limit = 2000): Promise<ScoredDoc[]> {
    try {
      const rows = await this.prisma.supportDocument.findMany({
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: { id: true, content: true, metadata: true },
      });
      return rows.map((r) => ({
        id: r.id,
        content: r.content,
        metadata: (r.metadata as Record<string, unknown>) ?? {},
        score: 0,
      }));
    } catch {
      return [];
    }
  }

  async upsertDocuments(
    docs: Array<{ content: string; metadata: Record<string, unknown> }>,
  ): Promise<number> {
    const vecs = await this.embeddings.embedDocuments(
      docs.map((d) => d.content),
    );
    let count = 0;
    for (let i = 0; i < docs.length; i++) {
      const lit = toVectorLiteral(vecs[i] ?? []);
      const id = randomUUID();
      await this.prisma.$queryRaw`
        INSERT INTO support_documents (id, content, metadata, embedding, "createdAt", "updatedAt")
         VALUES (${id}::uuid, ${docs[i].content}, ${JSON.stringify(docs[i].metadata ?? {})}::jsonb, ${lit}::vector, now(), now())`;
      count++;
    }
    return count;
  }

  private safeMeta(raw: string): Record<string, unknown> {
    try {
      const v = JSON.parse(raw) as unknown;
      return typeof v === 'object' && v !== null
        ? (v as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
}
