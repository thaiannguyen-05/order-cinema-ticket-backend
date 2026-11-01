import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { ToolsService, type SourceKind } from './tools.service';
import { LlmService } from './llm.service';
import { getInjectionSdk } from '../guards/injection.guard';
import { AiConfigService } from '../constants';
import type { ChatRequestDto } from '../dto/chat-request.dto';

export type ChatResult = {
  answer: string;
  sources: Array<{ chunk: number; source: string }>;
  toolCalls: string[];
  conversationId: string;
  sourceKind: SourceKind;
};

@Injectable()
export class AiSupportService {
  private readonly logger = new Logger(AiSupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tools: ToolsService,
    private readonly llm: LlmService,
    private readonly aiConfig: AiConfigService,
  ) {}

  async chat(dto: ChatRequestDto, userId?: string): Promise<ChatResult> {
    const cfg = this.aiConfig.resolve();
    const { cleaned } = this.tools.analyzeQuery(dto.query);
    const sourceKind = await this.tools.selectSource(cleaned);
    const topK = Math.min(dto.top_k ?? cfg.defaultTopK, cfg.maxTopK);

    const toolCalls: string[] = [
      `analyze_query`,
      `select_source:${sourceKind}`,
    ];
    let chunks: string[] = [];
    let sources: Array<{ chunk: number; source: string }> = [];

    // Structured branch (steps 4-7 PostgreSQL) + Vector branch (steps 4-8 VectorDB)
    const [structuredCtx, vectorDocs] = await Promise.all([
      sourceKind === 'vector'
        ? Promise.resolve('')
        : this.collectStructured(cleaned, userId, toolCalls),
      sourceKind === 'structured'
        ? Promise.resolve([])
        : this.tools.searchDocs(cleaned, topK).then((docs) => {
            toolCalls.push('search_docs');
            return docs;
          }),
    ]);

    const vectorChunks = vectorDocs.map((d) => d.content);
    sources = vectorDocs.map((d, i) => ({
      chunk: i + 1,
      source: String(
        typeof d.metadata?.['source'] === 'string'
          ? d.metadata?.['source']
          : 'support_documents',
      ),
    }));
    if (structuredCtx) {
      vectorChunks.unshift(`[Structured]\n${structuredCtx}`);
    }
    chunks = vectorChunks;

    const answer = await this.tools.response(chunks, cleaned);
    toolCalls.push('response');

    // Output guard (afterRequestHook)
    try {
      const sdk = getInjectionSdk();
      const wrapped = { choices: [{ message: { content: answer } }] };
      const r = (await sdk.scanOutput(
        { query: cleaned },
        wrapped,
        'chatComplete',
      )) as unknown as {
        shouldDeny: boolean;
      };
      if (r.shouldDeny) {
        throw new HttpException(
          { errorCode: 'AI_OUTPUT_BLOCKED' },
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.warn(`output scan failed: ${String(e)}`);
    }

    const conversationId = await this.persist(
      cleaned,
      answer,
      sources,
      toolCalls,
      {
        userId,
        conversationId: dto.conversationId,
      },
    );
    return { answer, sources, toolCalls, conversationId, sourceKind };
  }

  /** SSE: emit tool events then answer split into sentence chunks. */
  async *streamChat(
    dto: ChatRequestDto,
    userId?: string,
  ): AsyncGenerator<{ data: string }> {
    yield { data: JSON.stringify({ type: 'tool', name: 'analyze_query' }) };
    let result: ChatResult;
    try {
      result = await this.chat(dto, userId);
    } catch (e) {
      yield {
        data: JSON.stringify({
          type: 'error',
          message: e instanceof Error ? e.message : 'chat failed',
        }),
      };
      return;
    }
    yield {
      data: JSON.stringify({ type: 'tools', names: result.toolCalls }),
    };
    yield {
      data: JSON.stringify({ type: 'sources', sources: result.sources }),
    };
    // Stream answer by sentences to mimic token streaming (no websocket per spec)
    const parts = result.answer.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) ?? [
      result.answer,
    ];
    for (const p of parts) {
      yield { data: JSON.stringify({ type: 'chunk', text: p }) };
    }
    yield {
      data: JSON.stringify({
        type: 'done',
        conversationId: result.conversationId,
        sourceKind: result.sourceKind,
      }),
    };
  }

  private async collectStructured(
    query: string,
    userId: string | undefined,
    toolCalls: string[],
  ): Promise<string> {
    const out: string[] = [];
    // Heuristic keyword -> which structured API to call (LLM không sinh SQL).
    const q = query.toLowerCase();
    try {
      if (/(phim|film)/.test(q)) {
        const r = await this.tools.searchFilms(query.slice(0, 100), 3);
        toolCalls.push('search_films');
        out.push(`Films: ${JSON.stringify(r).slice(0, 1500)}`);
      }
      if (/(rạp|rap|cinema|suất|suat|show)/.test(q)) {
        const r = await this.tools.searchCinemasShowtimes(
          query.slice(0, 100),
          3,
        );
        toolCalls.push('search_cinemas_showtimes');
        out.push(`Cinemas: ${JSON.stringify(r).slice(0, 1500)}`);
      }
      const orderMatch = query.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
      );
      if (orderMatch && userId) {
        const r = await this.tools.getOrderStatus(orderMatch[0], userId);
        toolCalls.push('get_order_status');
        out.push(`Order: ${JSON.stringify(r).slice(0, 1000)}`);
      }
    } catch (e) {
      this.logger.warn(`structured collect failed: ${String(e)}`);
    }
    return out.join('\n');
  }

  private async persist(
    query: string,
    answer: string,
    sources: unknown,
    toolCalls: string[],
    opts: { userId?: string; conversationId?: string },
  ): Promise<string> {
    try {
      let convId = opts.conversationId;
      if (convId && opts.userId) {
        // Không tin conversationId client gửi: chỉ append khi thread thuộc về đúng user.
        const owned = await this.prisma.supportConversation.findFirst({
          where: { id: convId, userId: opts.userId },
          select: { id: true },
        });
        if (!owned) convId = undefined;
      }
      if (!convId) {
        const conv = await this.prisma.supportConversation.create({
          data: { userId: opts.userId ?? null },
        });
        convId = conv.id;
      }
      const req = (global as { __injectionScan?: unknown }).__injectionScan;
      await this.prisma.supportMessage.createMany({
        data: [
          {
            conversationId: convId,
            role: 'user',
            content: query,
          },
          {
            conversationId: convId,
            role: 'assistant',
            content: answer,
            sources: (sources ?? []) as never,
            toolCalls: toolCalls as never,
            injectionVerdict: (req ?? {}) as never,
          },
        ],
      });
      return convId;
    } catch (e) {
      this.logger.warn(`persist chat failed: ${String(e)}`);
      return opts.conversationId ?? 'ephemeral';
    }
  }
}
