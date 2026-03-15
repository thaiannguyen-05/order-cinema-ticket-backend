const logMock = jest.fn();

jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    green: (s: string) => s,
    yellow: (s: string) => s,
  },
}));

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({}));
});

jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({ log: logMock })),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    printf: jest.fn((fn: Function) => fn),
    json: jest.fn(() => ({})),
  },
  transports: {
    Console: jest.fn().mockImplementation(() => ({})),
  },
}));

const { MyLogger } = require('../../../../core/logger/logger.service') as {
  MyLogger: new () => {
    log: (msg: string, ctx?: string) => void;
    error: (msg: string, ctx?: string) => void;
    warn: (msg: string, ctx?: string) => void;
    debug: (msg: string, ctx?: string) => void;
    verbose: (msg: string, ctx?: string) => void;
    fatal: (msg: string, ctx?: string) => void;
  };
};

describe('MyLogger', () => {
  it('maps logger methods to underlying winston levels', () => {
    const logger = new MyLogger();

    logger.log('info msg', 'ctx');
    logger.error('error msg', 'ctx');
    logger.warn('warn msg', 'ctx');
    logger.debug('debug msg', 'ctx');
    logger.verbose('verbose msg', 'ctx');
    logger.fatal('fatal msg', 'ctx');

    expect(logMock).toHaveBeenCalledWith('info', 'info msg', { context: 'ctx' });
    expect(logMock).toHaveBeenCalledWith('error', 'error msg', { context: 'ctx' });
    expect(logMock).toHaveBeenCalledWith('warn', 'warn msg', { context: 'ctx' });
    expect(logMock).toHaveBeenCalledWith('debug', 'debug msg', { context: 'ctx' });
    expect(logMock).toHaveBeenCalledWith('verbose', 'verbose msg', { context: 'ctx' });
    expect(logMock).toHaveBeenCalledWith('fatal', 'fatal msg', { context: 'ctx' });
  });
});
