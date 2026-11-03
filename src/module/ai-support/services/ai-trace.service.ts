import { Injectable } from '@nestjs/common';

/** Token usage chuẩn hoá từ ChatGroq AIMessage (usage_metadata + response_metadata). */
export type AiTokenUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

/** Một bước trong RetrievalTrace chi tiết (verbose-only, non-prod). */
export type AiStepTrace = {
  name: string;
  durationMs: number;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  inputPreview?: string;
  outputPreview?: string;
  chunkCount?: number;
  tokenUsage?: AiTokenUsage | null;
};

export const AI_TRACE_PREVIEW_LIMIT = 2000;

export function truncatePreview(
  text: string,
  limit = AI_TRACE_PREVIEW_LIMIT,
): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…[truncated ${text.length - limit} chars]`;
}

export function extractTokenUsage(msg: {
  usage_metadata?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  response_metadata?: {
    tokenUsage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  };
}): AiTokenUsage | null {
  const u = msg.usage_metadata;
  if (
    u &&
    typeof u.total_tokens === 'number' &&
    Number.isFinite(u.total_tokens)
  ) {
    return {
      promptTokens:
        typeof u.input_tokens === 'number' && Number.isFinite(u.input_tokens)
          ? u.input_tokens
          : null,
      completionTokens:
        typeof u.output_tokens === 'number' && Number.isFinite(u.output_tokens)
          ? u.output_tokens
          : null,
      totalTokens: u.total_tokens,
    };
  }
  const t = msg.response_metadata?.tokenUsage;
  if (
    t &&
    (t.promptTokens !== undefined ||
      t.completionTokens !== undefined ||
      t.totalTokens !== undefined)
  ) {
    return {
      promptTokens: typeof t.promptTokens === 'number' ? t.promptTokens : null,
      completionTokens:
        typeof t.completionTokens === 'number' ? t.completionTokens : null,
      totalTokens: typeof t.totalTokens === 'number' ? t.totalTokens : null,
    };
  }
  return null;
}

@Injectable()
export class AiTraceService {
  truncate(text: string, limit = AI_TRACE_PREVIEW_LIMIT): string {
    return truncatePreview(text, limit);
  }

  step(
    name: string,
    durationMs: number,
    details?: Omit<AiStepTrace, 'name' | 'durationMs'>,
  ): AiStepTrace {
    return {
      name,
      durationMs: Math.max(0, Math.round(durationMs)),
      ...details,
    };
  }

  async timed<T>(
    name: string,
    fn: () => Promise<T>,
    details?: Omit<AiStepTrace, 'name' | 'durationMs'>,
  ): Promise<{ result: T; step: AiStepTrace }> {
    const start = Date.now();
    const result = await fn();
    return { result, step: this.step(name, Date.now() - start, details) };
  }
}
