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
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Observable, from } from 'rxjs';
import { ChatRequestDto } from './dto/chat-request.dto';
import { StreamQueryDto } from './dto/stream-query.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import { AiSupportService } from './services/ai-support.service';
import { IngestService } from './services/ingest.service';
import { InjectionGuard } from './guards/injection.guard';
import { InjectionOutputInterceptor } from './interceptors/injection-output.interceptor';
import { Roles } from '../../core/decorator/roles.decorator';
import { USER_ROLE } from '@prisma/client';
import { User } from '../../core/decorator/user.decorator';
import { PrismaService } from '../core-module/infra/prisma/prisma.service';

const queryValidation = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

/**
 * verbose trace (sources/toolCalls/intent/eval) chỉ mở ở non-production.
 * Production luôn trả gọn {answer, conversationId} để không lộ internals.
 */
function isVerboseAllowed(verbose?: boolean): boolean {
  return (
    verbose === true && (process.env.NODE_ENV ?? 'development') !== 'production'
  );
}

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
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chat with cinema support AI (read-only RAG)' })
  async chat(@Body() dto: ChatRequestDto, @User('id') userId?: string) {
    const r = await this.ai.chat(dto, userId);
    // Mặc định sạch như chat thật: chỉ answer + conversationId.
    // verbose=true mới kèm trace debug (sources/toolCalls/sourceKind/intent),
    // và chỉ có hiệu lực ở non-production.
    if (isVerboseAllowed(dto.verbose)) return r;
    return { answer: r.answer, conversationId: r.conversationId };
  }

  @Sse('chat/stream')
  @UseGuards(InjectionGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chat stream via SSE (no websocket)' })
  stream(
    @Query(queryValidation) query: StreamQueryDto,
    @User('id') userId?: string,
  ): Observable<MessageEvent> {
    // Propagate JWT identity (cookie-based EventSource included). When userId is
    // absent the service creates an ephemeral thread and never reads/appends a
    // supplied conversationId, so no cross-principal history leak is possible.
    const gen = this.ai.streamChat(query, userId);
    const pull = async function* () {
      for await (const e of gen) {
        yield { data: e.data } as MessageEvent;
      }
    };
    return from(pull());
  }

  @Get('conversations/:id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get conversation history' })
  async history(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(queryValidation) pagination: HistoryQueryDto,
    @User('id') userId?: string,
  ) {
    // Strict owner scoping: anonymous callers never read arbitrary threads.
    if (!userId) throw new UnauthorizedException('Login required');
    const conv = await this.prisma.supportConversation.findFirst({
      where: { id, userId },
      // Chỉ lộ role/content/createdAt: giữ sources/toolCalls/injectionVerdict
      // nội bộ, tránh lộ trace scan cho client.
      select: {
        id: true,
        userId: true,
        createdAt: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: pagination.limit,
          skip: pagination.offset,
          select: { role: true, content: true, createdAt: true },
        },
      },
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
