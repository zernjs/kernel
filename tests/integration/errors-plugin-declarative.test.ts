import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';
import { definePlugin } from '@plugin/definePlugin';
import { defineErrors } from '@errors';

describe('Plugin declarative errors', () => {
  it('binds errors namespace and emits via helper', async () => {
    const errors = defineErrors('auth', {
      InvalidCredentials: (p: { reason: string }) => p,
    });
    const { InvalidCredentials } = errors.factories;

    const Auth = definePlugin({
      name: 'auth',
      version: '1.0.0',
      errors,
      async setup() {
        return {};
      },
    });

    const kernel = createKernel().use(Auth).build();
    await kernel.init();

    let received: unknown = null;
    const off = kernel.errors.on(InvalidCredentials, p => {
      received = p;
    });

    await kernel.errors.report(InvalidCredentials({ reason: 'x' }));
    expect(received).toEqual({ reason: 'x' });
    off();
  });
});
