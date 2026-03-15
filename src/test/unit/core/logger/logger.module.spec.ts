jest.mock('../../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));

const { LoggerModule } = require('../../../../core/logger/logger.module') as {
  LoggerModule: unknown;
};

describe('LoggerModule', () => {
  it('module class is defined', () => {
    expect(LoggerModule).toBeDefined();
  });
});
