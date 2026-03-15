import { AppController } from '../../../app.controller';

describe('AppController', () => {
  it('delegates health check to app service', () => {
    const appService = {
      checkHealth: jest.fn().mockReturnValue('OK'),
    };

    const controller = new AppController(appService as never);

    expect(controller.checkHealth()).toBe('OK');
    expect(appService.checkHealth).toHaveBeenCalledTimes(1);
  });
});
