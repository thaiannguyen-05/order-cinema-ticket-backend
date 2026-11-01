import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppSecretsService {
  constructor(private readonly config: ConfigService) {}

  getGroqApiKey(): string {
    const key = this.config.getOrThrow<string>('GROQ_API_KEY').trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'Missing GROQ_API_KEY: set env GROQ_API_KEY. Chat is disabled until key is set.',
      );
    }
    return key;
  }

  hasGroqKey(): boolean {
    return this.config.get<string>('GROQ_API_KEY', '').trim().length > 0;
  }
}
