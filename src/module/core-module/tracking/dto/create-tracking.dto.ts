import { EVENT_TYPE } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateTrackingDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsEnum(EVENT_TYPE)
  @IsNotEmpty()
  eventType!: EVENT_TYPE;

  @IsString()
  @IsNotEmpty()
  page!: string;

  @IsOptional()
  @IsString()
  elementType?: string;

  @IsOptional()
  @IsString()
  elementId?: string;

  @IsOptional()
  @IsString()
  elementText?: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
