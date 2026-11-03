import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { ToolsService } from './tools.service';
import type { IntentKind, SourceKind } from './tools.service';
import { LlmService } from './llm.service';
import { RagEvalService, type RagEvalResult } from './rag-eval.service';
import { MetricsService } from '../../core-module/infra/metrics/metrics.service';
import { getInjectionSdk } from '../guards/injection.guard';
import { AiConfigService } from '../constants';
import type { ChatRequestDto } from '../dto/chat-request.dto';
import { buildOutOfScopeRefusal, isCatalogQuery } from './tools.service';
import type { AiStepTrace } from './ai-trace.service';
import { truncatePreview } from './ai-trace.service';

export type ChatResult = {
  answer: string;
  sources: Array<{ chunk: number; source: string }>;
  toolCalls: string[];
  conversationId: string;
  sourceKind: SourceKind;
  intent: IntentKind;
  eval?: RagEvalResult;
  trace?: AiStepTrace[];
};

@Injectable()
export class AiSupportService {
  private readonly logger = new Logger(AiSupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tools: ToolsService,
    private readonly llm: LlmService,
    private readonly aiConfig: AiConfigService,
    private readonly ragEval: RagEvalService,
    private readonly metrics: MetricsService,
  ) {}

  async chat(dto: ChatRequestDto, userId?: string): Promise<ChatResult> {
    const cfg = this.aiConfig.resolve();
    const trace: AiStepTrace[] = [];
    const t0Analyze = Date.now();
    const { cleaned } = this.tools.analyzeQuery(dto.query);
    trace.push({
      name: 'analyze_query',
      durationMs: Date.now() - t0Analyze,
      inputPreview: truncatePreview(dto.query ?? ''),
      outputPreview: truncatePreview(cleaned),
    });
    const { intent, sourceKind } = await this.tools.classifyIntent(
      cleaned,
      trace,
    );
    const topK = Math.min(dto.top_k ?? cfg.defaultTopK, cfg.maxTopK);

    const toolCalls: string[] = [`analyze_query`, `classify:${intent}`];
    if (intent === 'support') toolCalls.push(`select_source:${sourceKind}`);

    // Lịch sử hội thoại (Q9): 6 messages gần nhất, mỗi cái 500 ký tự, chỉ role+content.
    const historyText = await this.loadHistory(dto.conversationId, userId, 6);

    let answer: string;
    let sources: Array<{ chunk: number; source: string }> = [];
    let responseMode = '';
    // Chunks vector thuần (không gồm [Structured]) để judge precision/recall.
    let ragChunks: string[] = [];

    if (intent === 'smalltalk' || intent === 'identity') {
      // Bypass retrieval (Q7/Q11): trả lời trực tiếp, không cite.
      answer = await this.tools.responseDirect(
        cleaned,
        intent,
        historyText,
        trace,
      );
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
          : this.collectStructured(cleaned, userId, toolCalls, trace),
        sourceKind === 'structured'
          ? Promise.resolve([])
          : this.tools.searchDocs(cleaned, topK, trace).then((docs) => {
              toolCalls.push('search_docs');
              return docs;
            }),
      ]);
      const structuredCtx = structured.text;

      const rawVectorChunks = vectorDocs.map((d) => d.content);
      ragChunks = [...rawVectorChunks];
      const vectorChunks = [...rawVectorChunks];
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
      const res = await this.tools.response(
        vectorChunks,
        cleaned,
        {
          historyText,
          allowGeneral,
        },
        trace,
      );
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

    // Online RAG eval (Q4-Q6): realtime ở dev, không block chat thường.
    // verbose=true (non-production) -> await để dev thấy điểm ngay;
    // ngược lại fire-and-forget.
    const evalInput = {
      query: cleaned,
      chunks: ragChunks,
      answer,
      intent,
      sourceKind,
      topK,
    };
    const verboseEffective =
      dto.verbose === true &&
      (process.env.NODE_ENV ?? 'development') !== 'production';
    this.observeLlmTrace(trace);
    if (verboseEffective) {
      const evalRes = await this.evalAndObserve(evalInput);
      return {
        answer,
        sources,
        toolCalls,
        conversationId,
        sourceKind,
        intent,
        eval: evalRes,
        trace,
      };
    }
    void this.evalAndObserve(evalInput).catch((e) =>
      this.logger.warn(`rag eval background failed: ${String(e)}`),
    );
    // Non-verbose (prod): strip trace/prompts, keep only chat fields.
    // Metrics already observed above via histograms (no prompt leakage).
    return { answer, sources, toolCalls, conversationId, sourceKind, intent };
  }

  /** Observe LLM latency/tokens từ verbose trace. Không throw (unit test mock thiếu). */
  private observeLlmTrace(trace: AiStepTrace[]): void {
    try {
      const m = this.metrics as unknown as {
        observeAiLlm?: (
          durationSeconds: number,
          tokens: number,
          labels: { step: string; model: string },
        ) => void;
      };
      if (typeof m.observeAiLlm !== 'function') return;
      for (const s of trace) {
        const tokens = s.tokenUsage?.totalTokens ?? 0;
        m.observeAiLlm(s.durationMs / 1000, tokens, {
          step: s.name,
          model: s.model ?? 'none',
        });
      }
    } catch {
      // metrics chưa sẵn (unit test) -> bỏ qua
    }
  }

  /** Chấm precision/recall rồi observe Prometheus. Không throw. */
  private async evalAndObserve(input: {
    query: string;
    chunks: string[];
    answer: string;
    intent: IntentKind;
    sourceKind: SourceKind;
    topK: number;
  }): Promise<RagEvalResult> {
    try {
      const res = await this.ragEval.evaluate(input);
      if (
        res.status === 'evaluated' &&
        res.precision !== null &&
        res.recall !== null
      ) {
        this.metrics.observeAiRag(res.precision, res.recall, {
          intent: input.intent,
          source: input.sourceKind,
          top_k: input.topK,
        });
      } else {
        this.metrics.incAiRagEval(res.status);
      }
      return res;
    } catch (e) {
      this.logger.warn(`rag eval observe failed: ${String(e)}`);
      try {
        this.metrics.incAiRagEval('failed');
      } catch {
        // metrics chưa sẵn (unit test) -> bỏ qua
      }
      return {
        status: 'failed',
        method: 'none',
        precision: null,
        recall: null,
        topK: input.topK,
      };
    }
  }

  /** SSE: emit tool events then answer split into sentence chunks. */
  async *streamChat(
    dto: ChatRequestDto,
    userId?: string,
  ): AsyncGenerator<{ data: string }> {
    // verbose trace chỉ ở non-production (đồng bộ với controller).
    const verbose =
      (dto.verbose ?? false) &&
      (process.env.NODE_ENV ?? 'development') !== 'production';
    if (verbose)
      yield { data: JSON.stringify({ type: 'tool', name: 'analyze_query' }) };
    let result: ChatResult;
    try {
      result = await this.chat(dto, userId);
    } catch (e) {
      // Không lộ e.message nội bộ (Groq/Prisma). HttpException giữ
      // errorCode an toàn, lỗi khác map về generic.
      if (e instanceof HttpException) {
        const res = e.getResponse() as Record<string, unknown>;
        yield {
          data: JSON.stringify({
            type: 'error',
            message: 'chat failed',
            errorCode: res?.['errorCode'] ?? 'AI_CHAT_FAILED',
          }),
        };
      } else {
        yield {
          data: JSON.stringify({
            type: 'error',
            message: 'chat failed',
            errorCode: 'AI_CHAT_FAILED',
          }),
        };
      }
      return;
    }
    if (verbose) {
      yield {
        data: JSON.stringify({ type: 'tools', names: result.toolCalls }),
      };
      yield {
        data: JSON.stringify({ type: 'sources', sources: result.sources }),
      };
      if (result.trace) {
        yield {
          data: JSON.stringify({ type: 'trace', steps: result.trace }),
        };
      }
      if (result.eval) {
        yield {
          data: JSON.stringify({
            type: 'eval',
            precision: result.eval.precision,
            recall: result.eval.recall,
            status: result.eval.status,
            method: result.eval.method,
          }),
        };
      }
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
              eval: result.eval ?? null,
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
    trace?: AiStepTrace[],
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
        const tFilms = Date.now();
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
          // Chỉ list-all khi user hỏi liệt kê; query cụ thể không match
          // thì để trống để response() từ chối mềm thay vì bịa phim.
          if (isListAll) {
            r = (await this.tools.searchFilms('', 5)) as {
              films?: unknown[];
              total?: number;
            };
          }
        }
        toolCalls.push('search_films');
        trace?.push({
          name: 'search_films',
          durationMs: Date.now() - tFilms,
          inputPreview: truncatePreview(query.slice(0, 100)),
          outputPreview: truncatePreview(
            JSON.stringify({
              total:
                (r as { total?: number })?.total ??
                (r as { films?: unknown[] })?.films?.length ??
                0,
            }).slice(0, 500),
          ),
          chunkCount: Array.isArray((r as { films?: unknown[] })?.films)
            ? (r as { films?: unknown[] }).films!.length
            : 0,
        });
        if (r?.films && r.films.length > 0) {
          out.push(`Films: ${JSON.stringify(r).slice(0, 1500)}`);
          sourceTags.push('structured:films');
        }
      }
      if (/(rạp|rap|cinema|suất|suat|show)/.test(q)) {
        const tCine = Date.now();
        const r = (await this.tools.searchCinemasShowtimes(
          query.slice(0, 100),
          5,
        )) as { cinemas?: unknown[]; total?: number };
        const list = r?.cinemas;
        toolCalls.push('search_cinemas_showtimes');
        trace?.push({
          name: 'search_cinemas_showtimes',
          durationMs: Date.now() - tCine,
          inputPreview: truncatePreview(query.slice(0, 100)),
          outputPreview: truncatePreview(
            `total=${r?.total ?? list?.length ?? 0}`,
          ),
          chunkCount: list?.length ?? 0,
        });
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
        const tOrder = Date.now();
        const r = await this.tools.getOrderStatus(orderMatch[0], userId);
        toolCalls.push('get_order_status');
        trace?.push({
          name: 'get_order_status',
          durationMs: Date.now() - tOrder,
          inputPreview: truncatePreview(orderMatch[0]),
          outputPreview: truncatePreview(JSON.stringify(r).slice(0, 500)),
        });
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
          const tList = Date.now();
          const rows = await this.tools.listOrders(userId, 5);
          toolCalls.push('list_orders');
          trace?.push({
            name: 'list_orders',
            durationMs: Date.now() - tList,
            inputPreview: truncatePreview(`user:${userId}`),
            outputPreview: truncatePreview(`${rows.length} orders`),
            chunkCount: rows.length,
          });
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
      // Không echo conversationId client gửi khi DB lỗi (chưa verify
      // ownership): trả ephemeral để client không tưởng ID forged hợp lệ.
      return 'ephemeral';
    }
  }
}
