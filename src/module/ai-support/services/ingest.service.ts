import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { VectorStoreService } from './vector-store.service';
import { HybridRetrieverService } from './hybrid-retriever.service';
import { AiConfigService } from '../constants';

/**
 * Ingest pipeline: Film/Cinema (existing APIs via Prisma read) + docs/support/*.md
 * -> chunk 500/50 -> FastEmbed -> pgvector support_documents.
 * Run: `pnpm ai:ingest` (manual, not per-request).
 */
@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectors: VectorStoreService,
    private readonly hybrid: HybridRetrieverService,
    private readonly aiConfig: AiConfigService,
  ) {}

  async ingestAll(): Promise<{ films: number; cinemas: number; docs: number }> {
    const cfg = this.aiConfig.resolve();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: cfg.chunkSize,
      chunkOverlap: cfg.chunkOverlap,
    });

    // 1. Films
    const films = await this.prisma.film.findMany({
      take: 500,
      select: { id: true, film_name: true, synopsis_long: true },
    });
    const filmTexts = films.map(
      (f) =>
        `Film: ${f.film_name}\nSynopsis: ${(f.synopsis_long ?? '').slice(0, 2000)}`,
    );

    // 2. Cinemas
    const cinemas = await this.prisma.cinema.findMany({
      take: 500,
      select: {
        id: true,
        cinema_name: true,
        address: true,
        city: true,
        directions: true,
      },
    });
    const cinemaTexts = cinemas.map(
      (c) =>
        `Cinema: ${c.cinema_name}\nAddress: ${c.address ?? ''} ${c.city ?? ''}\nDirections: ${(c.directions ?? '').slice(0, 1000)}`,
    );

    // 3. Markdown policies/FAQ
    const supportDir = join(process.cwd(), 'docs', 'support');
    const mdTexts: Array<{ text: string; source: string }> = [];
    try {
      const files = readdirSync(supportDir).filter((f) => f.endsWith('.md'));
      for (const f of files) {
        const raw = readFileSync(join(supportDir, f), 'utf8');
        mdTexts.push({ text: raw, source: `docs/support/${basename(f)}` });
      }
    } catch {
      this.logger.warn('docs/support missing, skip md ingest');
    }

    const filmChunks = await splitter.createDocuments(filmTexts);
    const cinemaChunks = await splitter.createDocuments(cinemaTexts);

    let count = 0;
    count += await this.vectors.upsertDocuments(
      filmChunks.map((d, i) => ({
        content: d.pageContent,
        metadata: {
          source: 'Film',
          refId: films[i % Math.max(films.length, 1)]?.id ?? null,
        },
      })),
    );
    count += await this.vectors.upsertDocuments(
      cinemaChunks.map((d, i) => ({
        content: d.pageContent,
        metadata: {
          source: 'Cinema',
          refId: cinemas[i % Math.max(cinemas.length, 1)]?.id ?? null,
        },
      })),
    );
    for (const md of mdTexts) {
      const chunks = await splitter.createDocuments([md.text]);
      count += await this.vectors.upsertDocuments(
        chunks.map((d) => ({
          content: d.pageContent,
          metadata: { source: md.source },
        })),
      );
    }

    await this.hybrid.refreshBm25();
    this.logger.log(`ingest done: ${count} chunks`);
    return { films: films.length, cinemas: cinemas.length, docs: count };
  }
}
