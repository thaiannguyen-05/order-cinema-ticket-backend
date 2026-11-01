import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import {
  ToolsService,
  type IntentKind,
  type SourceKind,
} from './tools.service';
import { LlmService } from './llm.service';
import { getInjectionSdk } from '../guards/injection.guard';
import { AiConfigService } from '../constants';
import type { ChatRequestDto } from '../dto/chat-request.dto';
import { buildOutOfScopeRefusal, isCatalogQuery } from './tools.service';

export type ChatResult = {
  answer: string;
  sources: Array<{ chunk: number; source: string }>;
  toolCalls: string[];
  conversationId: string;
  sourceKind: SourceKind;
  intent: IntentKind;
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
    const { intent, sourceKind } = await this.tools.classifyIntent(cleaned);
    const topK = Math.min(dto.top_k ?? cfg.defaultTopK, cfg.maxTopK);

    const toolCalls: string[] = [`analyze_query`, `classify:${intent}`];
    if (intent === 'support') toolCalls.push(`select_source:${sourceKind}`);

    // Lịch sử hội thoại (Q9): 6 messages gần nhất, mỗi cái 500 ký tự, chỉ role+content.
    const historyText = await this.loadHistory(dto.conversationId, userId, 6);

    let answer: string;
    let sources: Array<{ chunk: number; source: string }> = [];
    let responseMode = '';

    if (intent === 'smalltalk' || intent === 'identity') {
      // Bypass retrieval (Q7/Q11): trả lời trực tiếp, không cite.
      answer = await this.tools.responseDirect(cleaned, intent, historyText);
      responseMode = 'response:direct';
      toolCalls.push(responseMode);
    } else if (intent === 'outofscope') {
      answer = buildOutOfScopeRefusal(cleaned);
      responseMode = 'response:refusal';
      toolCalls.push(responseMode);
    } else {
      // SupportInquiry: Structured branch + Vector branch như cũ.
      const [structured, vectorDocs] = await Promise.all([
        sourceKind === 'vector'
          ? Promise.resolve({ text: '', sourceTags: [] as string[] })
          : this.collectStructured(cleaned, userId, toolCalls),
        sourceKind === 'structured'
          ? Promise.resolve([])
          : this.tools.searchDocs(cleaned, topK).then((docs) => {
              toolCalls.push('search_docs');
              return docs;
            }),
      ]);
      const structuredCtx = structured.text;

      const vectorChunks = vectorDocs.map((d) => d.content);
      const vectorSources = vectorDocs.map((d, i) => ({
        chunk: i + 1,
        source: String(
          typeof d.metadata?.['source'] === 'string'
            ? d.metadata?.['source']
            : 'support_documents',
        ),
      }));
      // Structured luôn có provenance trong sources (trước đây sources [] gây hiểu nhầm).
      sources = [
        ...structured.sourceTags.map((t, i) => ({ chunk: i + 1, source: t })),
        ...vectorSources.map((s) => ({
          chunk: s.chunk + structured.sourceTags.length,
          source: s.source,
        })),
      ];
      if (structuredCtx) {
        vectorChunks.unshift(`[Structured]\n${structuredCtx}`);
      }

      const allowGeneral = vectorChunks.length === 0 && isCatalogQuery(cleaned);
      const res = await this.tools.response(vectorChunks, cleaned, {
        historyText,
        allowGeneral,
      });
      answer = res.text;
      responseMode = `response:${res.mode}`;
      toolCalls.push(responseMode);
    }

    // Output guard (afterRequestHook) — giữ cho mọi intent (Q12).
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
    return { answer, sources, toolCalls, conversationId, sourceKind, intent };
  }

  /** SSE: emit tool events then answer split into sentence chunks. */
  async *streamChat(
    dto: ChatRequestDto,
    userId?: string,
  ): AsyncGenerator<{ data: string }> {
    const verbose = dto.verbose ?? false;
    if (verbose)
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
    if (verbose) {
      yield {
        data: JSON.stringify({ type: 'tools', names: result.toolCalls }),
      };
      yield {
        data: JSON.stringify({ type: 'sources', sources: result.sources }),
      };
    }
    // Stream answer by sentences to mimic token streaming (no websocket per spec)
    const parts = result.answer.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) ?? [
      result.answer,
    ];
    for (const p of parts) {
      yield { data: JSON.stringify({ type: 'chunk', text: p }) };
    }
    yield {
      data: JSON.stringify(
        verbose
          ? {
              type: 'done',
              conversationId: result.conversationId,
              sourceKind: result.sourceKind,
              intent: result.intent,
            }
          : { type: 'done', conversationId: result.conversationId },
      ),
    };
  }

  /** Lịch sử hội thoại: N messages gần nhất, verify ownership như persist(). */
  private async loadHistory(
    conversationId: string | undefined,
    userId: string | undefined,
    limit = 6,
  ): Promise<string> {
    if (!conversationId) return '';
    // Anonymous callers never read existing threads: ephemeral only.
    if (!userId) return '';
    try {
      const owned = await this.prisma.supportConversation.findFirst({
        where: { id: conversationId, userId },
        select: { id: true },
      });
      if (!owned) return '';
      const msgs = await this.prisma.supportMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { role: true, content: true },
      });
      return msgs
        .reverse()
        .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
        .join('\n');
    } catch (e) {
      this.logger.warn(`load history failed: ${String(e)}`);
      return '';
    }
  }

  private async collectStructured(
    query: string,
    userId: string | undefined,
    toolCalls: string[],
  ): Promise<{ text: string; sourceTags: string[] }> {
    const out: string[] = [];
    const sourceTags: string[] = [];
    // Heuristic keyword -> which structured API to call (LLM không sinh SQL).
    const q = query.toLowerCase();
    const isListAll =
      /(những phim|danh sách|tat ca|tất cả|co phim|có phim|phim nào|phim gi|phim gì|rap nao|rạp nào|danh sách rạp)/.test(
        q,
      );
    try {
      if (/(phim|film)/.test(q)) {
        // contains cả câu gần như luôn total 0 — thử full query trước, rỗng thì list-all.
        let r = (await this.tools.searchFilms(query.slice(0, 100), 5)) as {
          films?: unknown[];
          total?: number;
        };
        if ((!r?.films || r.films.length === 0) && !isListAll) {
          // Thử rút gọn: bỏ stopwords, giữ từ dài >2 ký tự.
          const keywords = query
            .split(/[\s,.!?;:]+/)
            .filter(
              (w) =>
                w.length > 2 &&
                !/^(hiện|nay|đang|những|nào|mình|cho|hỏi|với|của|này|kia|không|nhỉ|ạ|ơi)$/i.test(
                  w,
                ),
            )
            .slice(0, 3)
            .join(' ');
          if (keywords)
            r = (await this.tools.searchFilms(keywords.slice(0, 100), 5)) as {
              films?: unknown[];
              total?: number;
            };
        }
        if (!r?.films || r.films.length === 0) {
          r = (await this.tools.searchFilms('', 5)) as {
            films?: unknown[];
            total?: number;
          };
        }
        toolCalls.push('search_films');
        if (r?.films && r.films.length > 0) {
          out.push(`Films: ${JSON.stringify(r).slice(0, 1500)}`);
          sourceTags.push('structured:films');
        }
      }
      if (/(rạp|rap|cinema|suất|suat|show)/.test(q)) {
        const r = (await this.tools.searchCinemasShowtimes(
          query.slice(0, 100),
          5,
        )) as { cinemas?: unknown[]; total?: number };
        const list = r?.cinemas;
        toolCalls.push('search_cinemas_showtimes');
        if (list && list.length > 0) {
          out.push(`Cinemas: ${JSON.stringify(r).slice(0, 1500)}`);
          sourceTags.push('structured:cinemas');
        } else if (isListAll) {
          const r2 = (await this.tools.searchCinemasShowtimes('', 5)) as {
            cinemas?: unknown[];
          };
          if (r2?.cinemas && r2.cinemas.length > 0) {
            out.push(`Cinemas: ${JSON.stringify(r2).slice(0, 1500)}`);
            sourceTags.push('structured:cinemas');
          }
        }
      }
      const orderMatch = query.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
      );
      const orderHints =
        /(order|đơn hàng|don hang|vé của tôi|ve cua toi|ve cua minh|vé của mình|đặt vé|dat ve|ticket)/.test(
          q,
        );
      if (orderMatch && userId) {
        const r = await this.tools.getOrderStatus(orderMatch[0], userId);
        toolCalls.push('get_order_status');
        if (r) {
          out.push(`Order: ${JSON.stringify(r).slice(0, 1000)}`);
          sourceTags.push('structured:order');
        }
      } else if (orderHints) {
        // Câu list/tra cứu order chung ("order của tôi", "đang có order nào") — không cần UUID.
        if (!userId) {
          toolCalls.push('list_orders:login_required');
          out.push(
            `Orders: user chưa đăng nhập nên không liệt kê được. Hãy đăng nhập rồi hỏi lại (vd: "order của tôi").`,
          );
          sourceTags.push('structured:orders');
        } else {
          const rows = await this.tools.listOrders(userId, 5);
          toolCalls.push('list_orders');
          if (rows.length > 0) {
            out.push(`Orders: ${JSON.stringify(rows).slice(0, 1500)}`);
          } else {
            out.push(`Orders: bạn chưa có order nào.`);
          }
          sourceTags.push('structured:orders');
        }
      }
    } catch (e) {
      this.logger.warn(`structured collect failed: ${String(e)}`);
    }
    return { text: out.join('\n'), sourceTags };
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
      if (convId) {
        if (!opts.userId) {
          // Anonymous: never append to a supplied thread (IDOR). Fork ephemeral.
          convId = undefined;
        } else {
          // Không tin conversationId client gửi: chỉ append khi thread thuộc về đúng user.
          const owned = await this.prisma.supportConversation.findFirst({
            where: { id: convId, userId: opts.userId },
            select: { id: true },
          });
          if (!owned) convId = undefined;
        }
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
