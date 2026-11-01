import { ChatRequestDto } from './chat-request.dto';

/**
 * GET query-string DTO cho SSE stream (giữ GET vì @Sse chỉ hỗ trợ GET).
 * Kế thừa toàn bộ trần của ChatRequestDto; @Type(()=>Number) ở base
 * tự coerce `top_k=5` (string) -> 5. Controller dùng
 * `@Query(new ValidationPipe({transform:true})) query: StreamQueryDto`.
 */
export class StreamQueryDto extends ChatRequestDto {}
