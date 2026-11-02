/* eslint-disable no-console */
// Smoke: chạy 2-3 câu hỏi vector qua AiSupportService (verbose) rồi in điểm eval.
// Chạy: TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register scripts/ai-rag-smoke.ts
// (transpile-only vì error.exception.ts có lỗi type có sẵn làm ts-node check fail)
import { NestFactory } from '@nestjs/core';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';
import { AiSupportService } from '../src/module/ai-support/services/ai-support.service';

const QUERIES = [
  'Chính sách hoàn vé thế nào?',
  'Hướng dẫn đặt vé cho người mới?',
  'Vé PENDING giữ được bao lâu?',
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const svc = app.get(AiSupportService);
    for (const q of QUERIES) {
      try {
        const r = await svc.chat(
          { query: q, top_k: 3, verbose: true } as never,
          undefined,
        );
        console.log(`Q: ${q}`);
        console.log(
          `  intent=${r.intent} source=${r.sourceKind} tools=[${r.toolCalls.join(',')}]`,
        );
        console.log(
          `  eval=${JSON.stringify(r.eval)} answer=${r.answer.slice(0, 120).replace(/\n/g, ' ')}...`,
        );
      } catch (e) {
        console.log(`Q: ${q} FAILED: ${String(e)}`);
      }
    }
    const text = await register.metrics();
    console.log('--- /metrics (app_ai_rag only) ---');
    for (const line of text.split('\n')) {
      if (line.startsWith('app_ai_rag')) console.log(line);
    }
  } finally {
    await app.close();
  }
}

void main().catch((e) => {
  console.error(`[ai-rag-smoke] failed: ${String(e)}`);
  process.exit(1);
});
