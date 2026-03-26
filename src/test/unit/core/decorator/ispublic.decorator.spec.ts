import 'reflect-metadata';
import {
  IS_PUBLIC_KEY,
  Public,
} from '../../../../core/decorator/ispublic.decorator';

describe('Public decorator', () => {
  it('sets isPublic metadata to true', () => {
    class TestController {
      @Public()
      handler() {}
    }

    const metadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      TestController.prototype.handler,
    );
    expect(metadata).toBe(true);
  });
});
