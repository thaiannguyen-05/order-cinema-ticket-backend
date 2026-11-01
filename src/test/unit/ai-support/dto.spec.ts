import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ChatRequestDto } from '../../../module/ai-support/dto/chat-request.dto';
import { StreamQueryDto } from '../../../module/ai-support/dto/stream-query.dto';
import { HistoryQueryDto } from '../../../module/ai-support/dto/history-query.dto';

describe('AiSupport DTO ceilings (service + controller reuse)', () => {
  it('ChatRequestDto applies default top_k=3', () => {
    const dto = plainToInstance(ChatRequestDto, { query: '  phim Dune  ' });
    expect(dto.top_k).toBe(3);
    expect(validateSync(dto).length).toBe(0);
  });

  it('ChatRequestDto rejects query > 1000 and top_k > 10', () => {
    const dto = plainToInstance(ChatRequestDto, {
      query: 'a'.repeat(1001),
      top_k: 11,
    });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('StreamQueryDto coerces string top_k from query-string', () => {
    const dto = plainToInstance(StreamQueryDto, {
      query: 'rap Quan 1',
      top_k: '5',
    });
    expect(dto.top_k).toBe(5);
    expect(validateSync(dto).length).toBe(0);
  });

  it('HistoryQueryDto defaults limit=20 offset=0 and caps limit<=50', () => {
    const dto = plainToInstance(HistoryQueryDto, {});
    expect(dto.limit).toBe(20);
    expect(dto.offset).toBe(0);
    const bad = plainToInstance(HistoryQueryDto, { limit: 51 });
    expect(validateSync(bad).length).toBeGreaterThan(0);
  });
});
