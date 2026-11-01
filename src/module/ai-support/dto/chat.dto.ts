import { ChatRequestDto } from './chat-request.dto';

/**
 * @deprecated Dùng ChatRequestDto (service + controller dùng chung, có default).
 * Giữ alias để không vỡ import cũ.
 */
export class ChatDto extends ChatRequestDto {}
