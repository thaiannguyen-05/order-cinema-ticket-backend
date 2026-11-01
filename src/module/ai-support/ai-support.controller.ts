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
    return this.ai.chat(dto, userId);
  }

  @Sse('chat/stream')
  @UseGuards(InjectionGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chat stream via SSE (no websocket)' })
  stream(
    @Query(queryValidation) query: StreamQueryDto,
  ): Observable<MessageEvent> {
    // SSE/EventSource không gửi được Authorization header nên userId
    // luôn undefined ở đây -> order riêng tư bị từ chối, hội thoại ephemeral.
    const gen = this.ai.streamChat(query);
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
    @Query(queryValidation) pagination: HistoryQueryDto,
    @User('id') userId?: string,
  ) {
    const conv = await this.prisma.supportConversation.findFirst({
      where: { id, ...(userId ? { userId } : {}) },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: pagination.limit,
          skip: pagination.offset,
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
