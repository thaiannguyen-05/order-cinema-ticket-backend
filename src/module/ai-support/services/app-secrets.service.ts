import { Injectable } from '@nestjs/common';

function readGroqKey(): string {
  const key = (process.env.GROQ_API_KEY || '').trim();
  return key;
}

export function getGroqApiKey(): string {
  const key = readGroqKey();
  if (!key) {
    throw new Error(
      'Missing GROQ_API_KEY: set env GROQ_API_KEY. Chat is disabled until key is set.',
    );
  }
  return key;
}

export function hasGroqKey(): boolean {
  return readGroqKey().length > 0;
}

@Injectable()
export class AppSecretsService {
  getGroqApiKey(): string {
    return getGroqApiKey();
  }
  hasGroqKey(): boolean {
    return hasGroqKey();
  }
}
