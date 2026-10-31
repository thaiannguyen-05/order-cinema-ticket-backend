import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { EmbeddingsService } from './embeddings.service';
import { resolveAiConfig } from '../constants';

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
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private ready = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Best-effort: DB may not have pgvector yet (docker image upgrade pending).
    try {
      await this.ensureReady();
    } catch (e) {
      this.logger.warn(`vector store not ready: ${String(e)}`);
    }
  }

  async ensureReady(): Promise<void> {
    if (this.ready) return;
    // 1. extension + columns + indexes (idempotent)
    try {
      const sqlPath = join(process.cwd(), 'prisma', 'vector-ext.sql');
      const sql = readFileSync(sqlPath, 'utf8');
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));
      for (const stmt of statements) {
        await this.prisma.$executeRawUnsafe(stmt);
      }
    } catch (e) {
      this.logger.warn(`vector-ext.sql apply failed: ${String(e)}`);
      throw e;
    }
    this.ready = true;
  }

  /** Dense cosine search on pgvector (step 6 Dense + step 7-8 in diagram). */
  async searchDense(query: string, k: number): Promise<ScoredDoc[]> {
    const cfg = resolveAiConfig();
    const topK = Math.min(k, cfg.maxTopK);
    const vec = await this.embeddings.embedQuery(query);
    const lit = toVectorLiteral(vec);
    const rows = await this.prisma.$queryRawUnsafe<RawRow[]>(
      `SELECT id::text AS id, content, COALESCE(metadata, '{}'::jsonb)::text AS metadata,
              1 - (embedding <=> $1::vector) AS score
         FROM support_documents
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2`,
      lit,
      topK,
    );
    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      metadata: this.safeMeta(r.metadata),
      score: Number(r.score),
    }));
  }

  /** Sparse lexical search via tsvector (phase-2 counterpart of BM25). */
  async searchSparse(query: string, k: number): Promise<ScoredDoc[]> {
    const cfg = resolveAiConfig();
    const topK = Math.min(k, cfg.maxTopK);
    try {
      const rows = await this.prisma.$queryRawUnsafe<RawRow[]>(
        `SELECT id::text AS id, content, COALESCE(metadata, '{}'::jsonb)::text AS metadata,
                ts_rank(search_tsv, plainto_tsquery('simple', $1)) AS score
           FROM support_documents
          WHERE search_tsv @@ plainto_tsquery('simple', $1)
          ORDER BY score DESC
          LIMIT $2`,
        query,
        topK,
      );
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
    await this.ensureReady();
    const vecs = await this.embeddings.embedDocuments(
      docs.map((d) => d.content),
    );
    let count = 0;
    for (let i = 0; i < docs.length; i++) {
      const lit = toVectorLiteral(vecs[i] ?? []);
      const id = randomUUID();
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO support_documents (id, content, metadata, embedding, "createdAt", "updatedAt")
         VALUES ($1::uuid, $2, $3::jsonb, $4::vector, now(), now())`,
        id,
        docs[i].content,
        JSON.stringify(docs[i].metadata ?? {}),
        lit,
      );
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
