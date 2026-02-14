/**
 * Logger configuration constants
 */
export const LOGGER_CONFIG = {
  DATE_FORMAT: 'DD/MM/YYYY HH:mm:ss',
  LOG_DIR: 'log',
  FILE_NAME_PATTERN: 'nest-log-%DATE%.log',
  FILE_DATE_PATTERN: 'YYYY-MM-DD-HH',
  MAX_SIZE: '20m',
  MAX_FILES: '14d',
  DEFAULT_LEVEL: 'debug',
  APP_NAME: 'NEST',
} as const;

/**
 * Custom log levels with their priorities
 */
export const CUSTOM_LOG_LEVELS = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  verbose: 5,
} as const;

/**
 * Custom log level colors for console output
 */
export const CUSTOM_LOG_COLORS = {
  fatal: 'red bold',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  verbose: 'cyan',
} as const;

export type LogLevel = keyof typeof CUSTOM_LOG_LEVELS;
