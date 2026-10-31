import { Injectable, Logger } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { FilmService } from '../../theater-module/film/film.service';
import { CinemaService } from '../../theater-module/cinema/cinema.service';
import { TicketService } from '../../theater-module/ticket/ticket.service';
import { PrismaService } from '../../core-module/infra/prisma/prisma.service';
import { HybridRetrieverService } from './hybrid-retriever.service';
import { LlmService } from './llm.service';
import { resolveAiConfig } from '../constants';
import type { ScoredDoc } from './vector-store.service';

export type SourceKind = 'structured' | 'vector' | 'both';

/** Step 3 in diagram: detect which DB will be got retrieval. */
export function ruleSelectSource(query: string): SourceKind {
  const q = query.toLowerCase();
  const structuredHints = [
    'order',
    'đặt vé',
    'dat ve',
    'vé của tôi',
    'suất chiếu',
    'suat chieu',
    'giờ chiếu',
    'giá vé',
    'gia ve',
    'rạp',
    'rap',
    'phim',
    'ghế',
    'ghe',
    'ticket',
    'showtime',
    'cinema',
  ];
  const vectorHints = [
    'chính sách',
    'chinh sach',
    'hoàn',
    'hoan',
    'đổi',
    'faq',
    'hướng dẫn',
    'huong dan',
    'quy định',
  ];
  const hasS = structuredHints.some((h) => q.includes(h));
  const hasV = vectorHints.some((h) => q.includes(h));
  if (hasS && hasV) return 'both';
  if (hasS) return 'structured';
  if (hasV) return 'vector';
  return 'both';
}

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    private readonly films: FilmService,
    private readonly cinemas: CinemaService,
    private readonly tickets: TicketService,
    private readonly prisma: PrismaService,
    private readonly retriever: HybridRetrieverService,
    private readonly llm: LlmService,
  ) {}

  /** Tool 1: phân tích query (normalize + guard đã làm ở InjectionGuard). */
  analyzeQuery(query: string): { cleaned: string; truncated: boolean } {
    const cfg = resolveAiConfig();
    const cleaned = query.trim().replace(/\s+/g, ' ');
    if (cleaned.length > cfg.maxQueryChars) {
      return { cleaned: cleaned.slice(0, cfg.maxQueryChars), truncated: true };
    }
    return { cleaned, truncated: false };
  }

  /** Tool 2: chọn query/DB (LLM override khi có key, fallback rule). */
  async selectSource(query: string): Promise<SourceKind> {
    const fallback = ruleSelectSource(query);
    if (!this.llm.hasKey()) return fallback;
    try {
      const prompt = ChatPromptTemplate.fromTemplate(
        `Phân loại câu hỏi rạp chiếu phim thành structured | vector | both.
- structured: hỏi phim, rạp, suất chiếu, giá vé, ghế, order/ticket cụ thể.
- vector: hỏi chính sách, hướng dẫn, FAQ, quy định.
- both: không rõ hoặc cần cả hai.
Chỉ trả về đúng 1 từ. Câu hỏi: {q}`,
      );
      const chain = prompt
        .pipe(this.llm.getModel({ maxTokens: 8, temperature: 0 }))
        .pipe(new StringOutputParser());
      const out = (await chain.invoke({ q: query })).trim().toLowerCase();
      if (out.includes('structured') && !out.includes('both'))
        return 'structured';
      if (out.includes('vector') && !out.includes('both')) return 'vector';
      return 'both';
    } catch {
      return fallback;
    }
  }

  // ---- Structured API tools (call existing services, never raw SQL) ----

  async searchFilms(search: string, limit = 5): Promise<unknown> {
    const res = await this.films.findFilms({
      search,
      limit: Math.min(limit, 20),
      page: 1,
    });
    return res;
  }

  async searchCinemasShowtimes(search: string, limit = 5): Promise<unknown> {
    const res = await this.cinemas.findCinemas({
      search,
      limit: Math.min(limit, 20),
      page: 1,
    } as never);
    return res;
  }

  async getTicketPrice(showTimeId: string): Promise<unknown> {
    // Read-only: basedPrice + tickets AVAILABLE count
    const [show, tickets] = await Promise.all([
      this.prisma.showTime.findUnique({ where: { id: showTimeId } }),
      this.prisma.ticket.findMany({
        where: { showTimeId },
        take: 20,
        select: { id: true, price: true, ticketStatus: true },
      }),
    ]);
    return { show, tickets };
  }

  async getOrderStatus(orderId: string, userId?: string): Promise<unknown> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) return null;
    // Ownership: user chỉ xem order của mình (trừ khi không truyền userId lúc public preview — vẫn ẩn userId).
    if (userId && order.userId !== userId) {
      return { denied: true };
    }
    const safe = { ...order };
    delete (safe as Record<string, unknown>).userId;
    return safe;
  }

  /** Vector branch: search_docs — factory style như simple_agent/tool.py make_search_tool. */
  async searchDocs(query: string, k = 3): Promise<ScoredDoc[]> {
    const cfg = resolveAiConfig();
    const topK = Math.min(k || cfg.defaultTopK, cfg.maxTopK);
    const docs = await this.retriever.invoke(query, topK);
    return docs;
  }

  /**
   * Tool response: merge retrieved chunks and answer (generative).
   * Few-shot VI như spec user: merge + lọc nhiễu + từ chối khi thiếu.
   * Dùng LCEL prompt.pipe(llm).pipe(parser) khi có key, fallback extractive khi offline.
   */
  async response(chunks: string[], promptText: string): Promise<string> {
    const cfg = resolveAiConfig();
    const capped = chunks.slice(0, cfg.maxTopK);
    if (capped.length === 0) {
      return 'Không tìm thấy chunk nào liên quan, không đủ thông tin để trả lời.';
    }
    if (!this.llm.hasKey()) {
      // Offline fallback: extractive merge, giữ cite [Chunk N]
      const parts = capped.map(
        (c, i) => `- ${c.slice(0, 400)} [Chunk ${i + 1}]`,
      );
      return `Yêu cầu chính: ${promptText}\nTổng hợp từ dữ liệu rạp:\n${parts.join('\n')}`;
    }
    const chunksText = capped
      .map((c, i) => `[Chunk ${i + 1}]\n${c}`)
      .join('\n\n---\n\n');
    const fewShot = `You are a Vietnamese RAG assistant for cinema ticket ordering.
Your assignment:
1. First, analyse and summarize the main requirement of \`prompt\` below. That summary is the base for your result.
2. Then merge the information from \`chunks\` (list[str]) — remove duplicates, keep complementary facts.
3. Build the final response in Vietnamese, ONLY from chunks. If chunks lack the answer, say so. Cite source as [Chunk N].

---
EXAMPLE 1 — Hợp nhất nhiều chunks (merge):

Input prompt: "Phim nào đang chiếu ở rạp Quận 1 cuối tuần này?"
Input chunks:
[Chunk 1]
Rạp Galaxy Quận 1 chiếu Dune 2 các suất 19:00, 21:30 thứ 7, Chủ nhật. Giá vé thường theo ShowTime.basedPrice.

[Chunk 2]
Dune 2 (Film): sci-fi, 166 phút, giới hạn T16. Trailer và synopsis_long có trên Film.

[Chunk 3]
Chính sách đổi trả: vé PENDING hết hạn sau 15 phút, vé PAID không đổi suất online.

Output:
- Yêu cầu chính: hỏi phim chiếu ở rạp Quận 1 cuối tuần.
- Tổng hợp: Rạp Galaxy Quận 1 chiếu Dune 2 các suất 19:00, 21:30 thứ 7, Chủ nhật [Chunk 1]. Phim Dune 2 sci-fi 166 phút, T16 [Chunk 2]. Lưu ý vé PENDING hết hạn sau 15 phút, vé PAID không đổi online [Chunk 3].

---
EXAMPLE 2 — Lọc chunk gây nhiễu (filter noise):

Input prompt: 'Vé PENDING giữ được bao lâu?'
Input chunks:
[Chunk 1]
Giá vé NORMAL theo ShowTime.basedPrice, COUPLE cao hơn.

[Chunk 2]
Order PENDING hết hạn sau 15 phút nếu không thanh toán, Ticket nhả về AVAILABLE.

Output:
- Yêu cầu chính: hỏi thời gian giữ vé PENDING.
- Tổng hợp: Order PENDING hết hạn sau 15 phút, vé nhả về AVAILABLE [Chunk 2]. [Chunk 1] nói về giá vé, không liên quan nên bỏ qua.

---
EXAMPLE 3 — Từ chối khi thiếu thông tin (no hallucination):

Input prompt: "Suất 22:00 còn ghế COUPLE không?"
Input chunks:
[Chunk 1]
Rạp Galaxy Quận 1 chiếu Dune 2 các suất 19:00, 21:30.

[Chunk 2]
Chính sách: AI chỉ tra cứu, không giữ chỗ.

Output:
- Yêu cầu chính: hỏi ghế COUPLE suất 22:00.
- Tổng hợp: Các chunk chỉ nêu suất 19:00, 21:30 [Chunk 1] và phạm vi AI [Chunk 2], KHÔNG có thông tin suất 22:00 hay ghế COUPLE. Vì vậy không đủ thông tin để trả lời, không suy đoán thêm.

---
REAL TASK:

Input prompt:
{prompt}

Input chunks:
{chunks_text}

Output:
`;
    try {
      const prompt = ChatPromptTemplate.fromTemplate('{input}');
      const chain = prompt
        .pipe(this.llm.getModel())
        .pipe(new StringOutputParser());
      const out = await chain.invoke({
        input: fewShot
          .replace('{prompt}', promptText)
          .replace('{chunks_text}', chunksText),
      });
      return out;
    } catch (e) {
      this.logger.warn(`response LLM failed: ${String(e)}`);
      return 'Không đủ thông tin để trả lời từ dữ liệu rạp hiện có.';
    }
  }

  /** LangChain tools array cho ReAct-style loop (agent tự gọi). */
  buildLangChainTools(userId?: string) {
    const searchDocsTool = tool(
      async ({ query }: { query: string }) => {
        const docs = await this.searchDocs(query, 5);
        if (docs.length === 0) return 'Không tìm thấy chunk nào liên quan.';
        return docs
          .map((d, i) => {
            const raw = d.metadata?.['source'];
            const src = typeof raw === 'string' ? raw : 'Unknown';
            return `[Chunk ${i + 1}] (source: ${src})\n${d.content}`;
          })
          .join('\n\n---\n\n');
      },
      {
        name: 'search_docs',
        description: 'Tìm chunks liên quan cho câu hỏi. Input: query string.',
        schema: z.object({ query: z.string() }),
      },
    );
    const searchFilmsTool = tool(
      async ({ search }: { search: string }) =>
        JSON.stringify(await this.searchFilms(search, 5)).slice(0, 4000),
      {
        name: 'search_films',
        description: 'Tra cứu phim theo tên. Input: search string.',
        schema: z.object({ search: z.string() }),
      },
    );
    const searchCinemasTool = tool(
      async ({ search }: { search: string }) =>
        JSON.stringify(await this.searchCinemasShowtimes(search, 5)).slice(
          0,
          4000,
        ),
      {
        name: 'search_cinemas_showtimes',
        description: 'Tra cứu rạp/suất chiếu theo tên rạp.',
        schema: z.object({ search: z.string() }),
      },
    );
    const ticketPriceTool = tool(
      async ({ showTimeId }: { showTimeId: string }) =>
        JSON.stringify(await this.getTicketPrice(showTimeId)).slice(0, 4000),
      {
        name: 'get_ticket_price',
        description: 'Lấy giá vé theo showTimeId.',
        schema: z.object({ showTimeId: z.string() }),
      },
    );
    const orderStatusTool = tool(
      async ({ orderId }: { orderId: string }) =>
        JSON.stringify(await this.getOrderStatus(orderId, userId)).slice(
          0,
          4000,
        ),
      {
        name: 'get_order_status',
        description: 'Tra cứu trạng thái order của chính user theo orderId.',
        schema: z.object({ orderId: z.string() }),
      },
    );
    return [
      searchDocsTool,
      searchFilmsTool,
      searchCinemasTool,
      ticketPriceTool,
      orderStatusTool,
    ];
  }
}
