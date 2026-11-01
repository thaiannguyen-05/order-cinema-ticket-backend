/* eslint-disable no-console */
// Manual ingest runner: loads Nest context and calls IngestService.
// Usage: pnpm ai:ingest
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IngestService } from '../src/module/ai-support/services/ingest.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const svc = app.get(IngestService);
    const res = await svc.ingestAll();
    console.log(`[ai:ingest] done: ${JSON.stringify(res)}`);
  } finally {
    await app.close();
  }
}

void main().catch((e) => {
  console.error(`[ai:ingest] failed: ${String(e)}`);
  process.exit(1);
});
