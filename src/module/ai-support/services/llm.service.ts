import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AppSecretsService } from './app-secrets.service';
import { extractTokenUsage, type AiTokenUsage } from './ai-trace.service';

let cached: ChatGroq | null = null;

export type LlmInvokeResult = {
  text: string;
  usage: AiTokenUsage | null;
  model: string;
  maxTokens: number;
  temperature: number;
};

@Injectable()
export class LlmService {
  constructor(
    private readonly config: ConfigService,
    private readonly secrets: AppSecretsService,
  ) {}

  hasKey(): boolean {
    return this.secrets.hasGroqKey();
  }

  getModel(params?: { maxTokens?: number; temperature?: number }): ChatGroq {
    // Không cache model có params riêng (classifier maxTokens 8/12) đè lên
    // model generative mặc định — đây từng làm answer cụt ~12 tokens.
    if (params?.maxTokens !== undefined || params?.temperature !== undefined) {
      const apiKey = this.secrets.getGroqApiKey();
      const model = this.config.getOrThrow<string>('AI_LLM_MODEL');
      const maxTokens = Number(
        this.config.getOrThrow<string>('AI_LLM_MAX_TOKENS'),
      );
      const temperature = Number(
        this.config.getOrThrow<string>('AI_LLM_TEMPERATURE'),
      );
      return new ChatGroq({
        model,
        apiKey,
        maxTokens: params?.maxTokens ?? maxTokens,
        temperature: params?.temperature ?? temperature,
      });
    }
    if (cached) return cached;
    const apiKey = this.secrets.getGroqApiKey();
    const model = this.config.getOrThrow<string>('AI_LLM_MODEL');
    const maxTokens = Number(
      this.config.getOrThrow<string>('AI_LLM_MAX_TOKENS'),
    );
    const temperature = Number(
      this.config.getOrThrow<string>('AI_LLM_TEMPERATURE'),
    );
    cached = new ChatGroq({
      model,
      apiKey,
      maxTokens: params?.maxTokens ?? maxTokens,
      temperature: params?.temperature ?? temperature,
    });
    return cached;
  }

  ensureAvailable(): void {
    if (!this.secrets.hasGroqKey()) {
      throw new ServiceUnavailableException(
        'AI chat is disabled: missing GROQ_API_KEY',
      );
    }
  }

  getModelInfo(params?: { maxTokens?: number; temperature?: number }): {
    model: string;
    maxTokens: number;
    temperature: number;
  } {
    const model = this.config.getOrThrow<string>('AI_LLM_MODEL');
    const maxTokens = Number(
      this.config.getOrThrow<string>('AI_LLM_MAX_TOKENS'),
    );
    const temperature = Number(
      this.config.getOrThrow<string>('AI_LLM_TEMPERATURE'),
    );
    return {
      model,
      maxTokens: params?.maxTokens ?? maxTokens,
      temperature: params?.temperature ?? temperature,
    };
  }

  async invokeTemplate(
    template: string,
    vars: Record<string, string>,
    params?: { maxTokens?: number; temperature?: number },
    callbacks?: never,
  ): Promise<LlmInvokeResult> {
    const info = this.getModelInfo(params);
    const model = this.getModel(params);
    const prompt = ChatPromptTemplate.fromTemplate(template);
    const msg = await prompt
      .pipe(model)
      // LangSmith/Langfuse: pass callbacks via Runnable config when wired, no hard dep.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .invoke(vars, (callbacks ? { callbacks } : undefined) as any);
    const raw = msg.content;
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
    const usage = extractTokenUsage(
      msg as {
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
      },
    );
    return { text, usage, ...info };
  }
}
