import type { CUSTOM_LOG_LEVELS } from '../logger.constant';

export type LogLevel = keyof typeof CUSTOM_LOG_LEVELS;
