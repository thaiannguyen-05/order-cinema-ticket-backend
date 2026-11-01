import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGroq } from '@langchain/groq';
import { AppSecretsService } from './app-secrets.service';

let cached: ChatGroq | null = null;

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
}
