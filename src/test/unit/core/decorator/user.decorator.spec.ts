import { User } from '../../../../core/decorator/user.decorator';

describe('User decorator factory', () => {
  it('decorator should be defined', () => {
    expect(User).toBeDefined();
    expect(typeof User).toBe('function');
  });
});
