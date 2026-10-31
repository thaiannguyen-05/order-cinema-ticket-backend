import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable, from } from 'rxjs';
import { ChatDto } from './dto/chat.dto';
import { AiSupportService } from './services/ai-support.service';
import { IngestService } from './services/ingest.service';
import { InjectionGuard } from './guards/injection.guard';
import { InjectionOutputInterceptor } from './interceptors/injection-output.interceptor';
import { Roles } from '../../core/decorator/roles.decorator';
import { USER_ROLE } from '@prisma/client';
import { User } from '../../core/decorator/user.decorator';
import { PrismaService } from '../core-module/infra/prisma/prisma.service';

@ApiTags('AiSupport')
@ApiBearerAuth('bearerAuth')
@Controller({ path: 'ai-support', version: '1' })
@UseInterceptors(InjectionOutputInterceptor)
export class AiSupportController {
  constructor(
    private readonly ai: AiSupportService,
    private readonly ingestService: IngestService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('chat')
  @HttpCode(200)
  @UseGuards(InjectionGuard)
  @ApiOperation({ summary: 'Chat with cinema support AI (read-only RAG)' })
  async chat(@Body() dto: ChatDto, @User('id') userId?: string) {
    return this.ai.chat(dto.query, {
      topK: dto.top_k,
      userId,
      conversationId: dto.conversationId,
    });
  }

  @Sse('chat/stream')
  @UseGuards(InjectionGuard)
  @ApiOperation({ summary: 'Chat stream via SSE (no websocket)' })
  stream(
    @Query('query') query: string,
    @Query('top_k') topK?: string,
  ): Observable<MessageEvent> {
    const top_k = topK ? parseInt(topK, 10) : undefined;
    // userId unavailable in SSE EventSource (no headers); conversation is ephemeral unless chat POST used.
    const gen = this.ai.streamChat(query ?? '', {
      topK: Number.isFinite(top_k as number) ? (top_k as number) : undefined,
    });
    const pull = async function* () {
      for await (const e of gen) {
        yield { data: e.data } as MessageEvent;
      }
    };
    return from(pull());
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation history' })
  async history(
    @Param('id', ParseUUIDPipe) id: string,
    @User('id') userId?: string,
  ) {
    const conv = await this.prisma.supportConversation.findFirst({
      where: { id, ...(userId ? { userId } : {}) },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return conv;
  }

  @Post('ingest')
  @Roles(USER_ROLE.ADMIN)
  @ApiOperation({ summary: 'Re-ingest Film/Cinema/docs into pgvector (admin)' })
  async ingest() {
    return this.ingestService.ingestAll();
  }
}
