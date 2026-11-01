import { Module } from '@nestjs/common';
import { AiSupportController } from './ai-support.controller';
import { AiSupportService } from './services/ai-support.service';
import { ToolsService } from './services/tools.service';
import { LlmService } from './services/llm.service';
import { EmbeddingsService } from './services/embeddings.service';
import { VectorStoreService } from './services/vector-store.service';
import { HybridRetrieverService } from './services/hybrid-retriever.service';
import { IngestService } from './services/ingest.service';
import { AppSecretsService } from './services/app-secrets.service';
import { AiConfigService } from './constants';
import { FilmModule } from '../theater-module/film/film.module';
import { CinemaModule } from '../theater-module/cinema/cinema.module';

@Module({
  imports: [FilmModule, CinemaModule],
  controllers: [AiSupportController],
  providers: [
    AiConfigService,
    AppSecretsService,
    LlmService,
    EmbeddingsService,
    VectorStoreService,
    HybridRetrieverService,
    ToolsService,
    AiSupportService,
    IngestService,
  ],
  exports: [AiSupportService, HybridRetrieverService],
})
export class AiSupportModule {}
