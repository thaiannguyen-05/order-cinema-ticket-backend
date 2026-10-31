import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGroq } from '@langchain/groq';
import { getGroqApiKey, hasGroqKey } from './app-secrets.service';

let cached: ChatGroq | null = null;

@Injectable()
export class LlmService {
  constructor(private readonly config: ConfigService) {}

  hasKey(): boolean {
    return hasGroqKey();
  }

  getModel(params?: { maxTokens?: number; temperature?: number }): ChatGroq {
    if (cached) return cached;
    const apiKey = getGroqApiKey();
    const model = this.config.get<string>('AI_LLM_MODEL', 'qwen/qwen3.8-27b');
    const maxTokens = Number(
      this.config.get<string>('AI_LLM_MAX_TOKENS', '256'),
    );
    const temperature = Number(
      this.config.get<string>('AI_LLM_TEMPERATURE', '0.5'),
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
    if (!hasGroqKey()) {
      throw new ServiceUnavailableException(
        'AI chat is disabled: missing GROQ_API_KEY',
      );
    }
  }
}
