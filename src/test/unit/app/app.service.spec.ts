import { AppService } from '../../../app.service';

describe('AppService', () => {
  it('returns OK for health check', () => {
    const service = new AppService();
    expect(service.checkHealth()).toBe('OK');
  });
});
