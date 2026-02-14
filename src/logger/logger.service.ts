import { type LoggerService } from '@nestjs/common';
import { createLogger, format, type Logger, transports } from 'winston';
import chalk from 'chalk';
import DailyRotateFile from 'winston-daily-rotate-file';
import {
  CUSTOM_LOG_COLORS,
  CUSTOM_LOG_LEVELS,
  LOGGER_CONFIG,
  LogLevel,
} from './logger.constant';
const customLevels = {
  levels: CUSTOM_LOG_LEVELS,
  colors: CUSTOM_LOG_COLORS,
};

export class MyLogger implements LoggerService {
  private readonly logger: Logger;

  constructor() {
    this.logger = createLogger({
      levels: customLevels.levels,
      level: LOGGER_CONFIG.DEFAULT_LEVEL,

      format: format.combine(
        format.timestamp({ format: LOGGER_CONFIG.DATE_FORMAT }),
        format.errors({ stack: true }),
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize({ all: true }),

            format.printf((info) => {
              const level = info.level;
              const message = String(info.message);
              const timestamp = String(info['timestamp']);
              const rawContext = info['context'];
              const context =
                typeof rawContext === 'string' ? rawContext : 'App';

              const strApp = chalk.green(`[${LOGGER_CONFIG.APP_NAME}]`);
              const strContext = chalk.yellow(`[${context}]`);

              return `${strApp} - ${timestamp} ${level} ${strContext} ${message}`;
            }),
          ),
        }),

        new DailyRotateFile({
          dirname: LOGGER_CONFIG.LOG_DIR,
          filename: LOGGER_CONFIG.FILE_NAME_PATTERN,
          datePattern: LOGGER_CONFIG.FILE_DATE_PATTERN,
          zippedArchive: false,
          maxSize: LOGGER_CONFIG.MAX_SIZE,
          maxFiles: LOGGER_CONFIG.MAX_FILES,

          format: format.combine(format.timestamp(), format.json()),
        }),
      ],
    });
  }

  private wrap(level: LogLevel, message: string, context?: string): void {
    this.logger.log(level, message, { context });
  }

  log(message: string, context?: string): void {
    this.wrap('info', message, context);
  }

  error(message: string, context?: string): void {
    this.wrap('error', message, context);
  }

  warn(message: string, context?: string): void {
    this.wrap('warn', message, context);
  }

  debug(message: string, context?: string): void {
    this.wrap('debug', message, context);
  }

  verbose(message: string, context?: string): void {
    this.wrap('verbose', message, context);
  }

  fatal(message: string, context?: string): void {
    this.wrap('fatal', message, context);
  }
}
