import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';
import { definePlugin } from '@plugin/definePlugin';
import { createErrors, defineError } from '@errors/error-bus';

describe('Plugin declarative errors', () => {
  it('binds errors namespace and emits via helper', async () => {
    const errors = createErrors('auth', {
      InvalidCredentials: defineError(),
    });

    const Auth = definePlugin({
      name: 'auth',
      version: '1.0.0',
      errors: { namespace: errors.namespace, kinds: errors.kinds },
      async setup() {
        return {};
      },
    });

    const kernel = createKernel().use(Auth).build();
    await kernel.init();

    let received: unknown = null;
    const off = kernel.errors.on('auth', 'InvalidCredentials', p => {
      received = p;
    });

    await kernel.errors.emit('auth', 'InvalidCredentials', { reason: 'x' });
    expect(received).toEqual({ reason: 'x' });
    off();
  });
});
