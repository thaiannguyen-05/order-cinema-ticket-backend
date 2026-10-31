import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatDto {
  @IsString()
  @MaxLength(1000)
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  top_k?: number;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
