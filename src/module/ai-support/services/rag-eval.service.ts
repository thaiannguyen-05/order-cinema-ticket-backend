import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { LlmService } from './llm.service';
import type { IntentKind, SourceKind } from './tools.service';

export type RagEvalStatus = 'evaluated' | 'skipped' | 'failed';
export type RagEvalMethod = 'llm' | 'heuristic' | 'none';

export type RagEvalInput = {
  query: string;
  chunks: string[];
  answer: string;
  intent: IntentKind;
  sourceKind: SourceKind;
  topK: number;
};

export type RagEvalResult = {
  status: RagEvalStatus;
  method: RagEvalMethod;
  precision: number | null;
  recall: number | null;
  topK: number;
};

const VI_STOPWORDS = new Set(
  'là,của,và,cho,với,các,những,một,cái,để,trong,khi,này,kia,đó,không,có,gì,nào,bạn,mình,tôi,chúng,anh,chị,em,ông,bà,hỏi,xin,về,ở,tại,từ,đến,như,thì,là,được,hay,hoặc,nếu,thế,nên,rất,quá,lắm,ạ,nhỉ,ơi,nhé,đây,đấy,vậy,thế,ai,con,còn,hết,cũng,đã,đang,sẽ,cần,muốn,hãy,bị,do,vì,bởi,mà,còn,thêm,cả,mỗi,từng,qua,lại,lên,xuống,ra,vào,không,the,a,an,of,to,in,on,for,with,is,are,was,were,be,been,what,how,when,where,which,who,do,does,did,can,could,please,thanks,thank,you,hello,hi'.split(
    ',',
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zà-ỹ0-9_]+/iu)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !VI_STOPWORDS.has(w));
}

/** RAGAS context precision: rank-weighted. v_k=1 nếu chunk k relevant. */
export function computeContextPrecision(relevant: boolean[]): number {
  const total = relevant.filter(Boolean).length;
  if (relevant.length === 0 || total === 0) return 0;
  let num = 0;
  let hitSoFar = 0;
  for (let k = 0; k < relevant.length; k++) {
    if (relevant[k]) {
      hitSoFar += 1;
      num += hitSoFar / (k + 1);
    }
  }
  const v = num / total;
  return Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
}

export function heuristicRelevance(query: string, chunk: string): boolean {
  const q = new Set(tokenize(query));
  if (q.size === 0) return false;
  const c = new Set(tokenize(chunk.slice(0, 2000)));
  let overlap = 0;
  for (const t of q) if (c.has(t)) overlap += 1;
  if (overlap >= 2) return true;
  if (q.size <= 2 && overlap >= 1) return true;
  // Fallback: query dài mà chunk chứa nguyên cụm 8 ký tự trở lên.
  const nq = query.toLowerCase().trim();
  if (nq.length >= 8 && chunk.toLowerCase().includes(nq.slice(0, 12)))
    return true;
  return false;
}

export function heuristicPrecision(query: string, chunks: string[]): number {
  if (chunks.length === 0) return 0;
  const rel = chunks.map((c) => heuristicRelevance(query, c));
  return computeContextPrecision(rel);
}

export function splitClaims(answer: string): string[] {
  const parts = answer.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim());
  return parts.filter((s) => s.length >= 12);
}

export function heuristicRecall(answer: string, chunks: string[]): number {
  const claims = splitClaims(answer);
  if (claims.length === 0) return 1; // refusal rỗng/không claim factual -> không hallucination
  if (chunks.length === 0) return 0;
  const chunkTokens = chunks.map((c) => new Set(tokenize(c.slice(0, 2000))));
  let covered = 0;
  for (const claim of claims) {
    const toks = tokenize(claim);
    if (toks.length === 0) {
      covered += 1;
      continue;
    }
    const hit = chunkTokens.some((ct) => {
      let ov = 0;
      for (const t of toks) if (ct.has(t)) ov += 1;
      return ov >= 2 || (toks.length <= 2 && ov >= 1);
    });
    if (hit) covered += 1;
  }
  return Math.round((covered / claims.length) * 1000) / 1000;
}

/** Parse LLM relevance JSON robust: {"relevant":[1,0]} hoặc [true,false] / "1,0,1". */
export function parseRelevanceJson(raw: string, n: number): boolean[] | null {
  try {
    const m = raw.match(/\[[\s\S]*?\]/);
    const cand = m ? m[0] : raw.trim();
    const arr = JSON.parse(cand) as unknown;
    const list = Array.isArray(arr)
      ? arr
      : Array.isArray((arr as { relevant?: unknown })?.relevant)
        ? (arr as { relevant: unknown[] }).relevant
        : null;
    if (!list) return null;
    const out = list.slice(0, n).map((v) => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v >= 1;
      const s = String(v).trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'relevant';
    });
    while (out.length < n) out.push(false);
    return out;
  } catch {
    return null;
  }
}

/** Parse LLM coverage JSON: {"covered":2,"total":3} hoặc {"claims":[{covered:true}]}. */
export function parseCoverageJson(
  raw: string,
): { covered: number; total: number } | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const o = JSON.parse(m[0]) as Record<string, unknown>;
    if (Array.isArray(o['claims'])) {
      const claims = o['claims'] as Array<Record<string, unknown>>;
      const total = claims.length;
      const covered = claims.filter((c) => {
        const v = c['covered'];
        return (
          v === true ||
          v === 1 ||
          String(v).toLowerCase() === 'true' ||
          String(v) === '1'
        );
      }).length;
      if (total === 0) return { covered: 1, total: 1 };
      return { covered, total };
    }
    const covered = Number(o['covered']);
    const total = Number(o['total']);
    if (!Number.isFinite(covered) || !Number.isFinite(total) || total <= 0)
      return null;
    return {
      covered: Math.max(0, Math.min(total, Math.round(covered))),
      total: Math.round(total),
    };
  } catch {
    return null;
  }
}

@Injectable()
export class RagEvalService {
  private readonly logger = new Logger(RagEvalService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly config: ConfigService,
  ) {}

  shouldEvaluate(
    input: Pick<RagEvalInput, 'intent' | 'sourceKind' | 'chunks'>,
  ): boolean {
    if (input.intent !== 'support') return false;
    if (input.sourceKind !== 'vector' && input.sourceKind !== 'both')
      return false;
    if (!input.chunks || input.chunks.length === 0) return false;
    return true;
  }

  private sampleRate(): number {
    const raw = this.config.get<string | number>('AI_EVAL_SAMPLE_RATE', '1');
    const v = Number(raw);
    if (!Number.isFinite(v)) return 1;
    return Math.min(1, Math.max(0, v));
  }

  private timeoutMs(): number {
    const raw = this.config.get<string | number>('AI_EVAL_TIMEOUT_MS', '5000');
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) return 5000;
    return Math.min(15000, Math.round(v));
  }

  private withTimeout<T>(p: Promise<T>): Promise<T> {
    const ms = this.timeoutMs();
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error(`rag eval timeout ${ms}ms`)),
        ms,
      );
      // Avoid leaking the timer handle on success/failure.
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e instanceof Error ? e : new Error(String(e)));
        },
      );
    });
  }

  async evaluate(input: RagEvalInput): Promise<RagEvalResult> {
    const topK = input.topK;
    if (!this.shouldEvaluate(input)) {
      return {
        status: 'skipped',
        method: 'none',
        precision: null,
        recall: null,
        topK,
      };
    }
    if (Math.random() > this.sampleRate()) {
      return {
        status: 'skipped',
        method: 'none',
        precision: null,
        recall: null,
        topK,
      };
    }
    const query = input.query.slice(0, 1000);
    const chunks = input.chunks.slice(0, 10).map((c) => c.slice(0, 1200));
    const answer = input.answer.slice(0, 3000);
    if (!query.trim() || !answer.trim()) {
      return {
        status: 'skipped',
        method: 'none',
        precision: null,
        recall: null,
        topK,
      };
    }

    if (!this.llm.hasKey()) {
      return {
        status: 'evaluated',
        method: 'heuristic',
        precision: heuristicPrecision(query, chunks),
        recall: heuristicRecall(answer, chunks),
        topK,
      };
    }

    try {
      const [relevant, coverage] = await this.withTimeout(
        Promise.all([
          this.judgeRelevance(query, chunks),
          this.judgeCoverage(answer, chunks),
        ]),
      );
      if (!relevant || !coverage) throw new Error('llm judge parse failed');
      const precision = computeContextPrecision(relevant);
      const recall =
        coverage.total <= 0
          ? 1
          : Math.round((coverage.covered / coverage.total) * 1000) / 1000;
      return { status: 'evaluated', method: 'llm', precision, recall, topK };
    } catch (e) {
      this.logger.warn(`rag eval LLM failed, heuristic fallback: ${String(e)}`);
      try {
        return {
          status: 'evaluated',
          method: 'heuristic',
          precision: heuristicPrecision(query, chunks),
          recall: heuristicRecall(answer, chunks),
          topK,
        };
      } catch (e2) {
        this.logger.warn(`rag eval heuristic failed: ${String(e2)}`);
        return {
          status: 'failed',
          method: 'none',
          precision: null,
          recall: null,
          topK,
        };
      }
    }
  }

  private async judgeRelevance(
    query: string,
    chunks: string[],
  ): Promise<boolean[] | null> {
    const list = chunks
      .map((c, i) => `[Chunk ${i + 1}]\n${c}`)
      .join('\n\n---\n\n');
    const prompt =
      `Bạn chấm retrieval cho chatbot đặt vé rạp. Query và N chunks (theo thứ tự rank).\n` +
      `Chunk relevant (=1) nếu chứa thông tin TRỰC TIẾP trả lời query (phim/rạp/suất/giá/policy/order). Nhiễu/không liên quan (=0).\n` +
      `Chỉ trả JSON duy nhất, không giải thích. Format: {"relevant":[1,0,1]}\n\n` +
      `Query: ${query}\n\nChunks:\n${list}`;
    const out = await ChatPromptTemplate.fromTemplate('{input}')
      .pipe(this.llm.getModel({ maxTokens: 200, temperature: 0 }))
      .pipe(new StringOutputParser())
      .invoke({ input: prompt });
    return parseRelevanceJson(out, chunks.length);
  }

  private async judgeCoverage(
    answer: string,
    chunks: string[],
  ): Promise<{ covered: number; total: number } | null> {
    const list = chunks
      .map((c, i) => `[Chunk ${i + 1}]\n${c}`)
      .join('\n\n---\n\n');
    const prompt =
      `Bạn chấm độ grounded của câu trả lời chatbot rạp phim.\n` +
      `Tách answer thành các factual claim (bỏ chào hỏi/câu gợi ý chung). Với mỗi claim, covered=true nếu được ít nhất 1 chunk chống lưng, ngược lại false.\n` +
      `Chỉ trả JSON duy nhất. Format: {"claims":[{"text":"...","covered":true}]}\n\n` +
      `Answer: ${answer}\n\nChunks:\n${list}`;
    const out = await ChatPromptTemplate.fromTemplate('{input}')
      .pipe(this.llm.getModel({ maxTokens: 250, temperature: 0 }))
      .pipe(new StringOutputParser())
      .invoke({ input: prompt });
    const parsed = parseCoverageJson(out);
    if (parsed) return parsed;
    // Fallback format {"covered":X,"total":Y} nằm trong cùng parser.
    return null;
  }
}
