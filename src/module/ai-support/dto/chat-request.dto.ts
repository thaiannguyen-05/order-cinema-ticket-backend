import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Shared request DTO — service + controller reuse (single source of truth).
 * Trần cứng (input ceiling): DTO là vòng 1, InjectionGuard.scanInput là vòng 2.
 */
export class ChatRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  // Cấm control-char (kể cả \n,\t cũng bị loại ở đây để chặn smuggling;
  // multi-line question phải gửi từng câu riêng).
  @Matches(/^[\x20-\uFFFF]*$/, {
    message: 'query contains control characters',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  top_k: number = 3;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  /**
   * verbose=true trả full trace debug (sources/toolCalls/sourceKind/intent).
   * Mặc định false: chỉ {answer, conversationId} để UI chat thật, không log.
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === true || value === 'true' || value === '1' ? true : false,
  )
  verbose?: boolean = false;
}
