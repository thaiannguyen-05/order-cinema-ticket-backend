jest.mock('../../../../module/core-module/infra/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));

const { LoggerModule } =
  require('../../../../module/core-module/infra/logger/logger.module') as {
    LoggerModule: unknown;
  };

describe('LoggerModule', () => {
  it('module class is defined', () => {
    expect(LoggerModule).toBeDefined();
  });
});
