import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';

describe('HookBus basic', () => {
  it('defines and emits hooks', async () => {
    const kernel = createKernel().build();
    const onLogin = kernel.hooks.define<{ userId: string }>('auth.onLogin');
    let received: string | null = null;
    const off = onLogin.on(p => {
      received = p.userId;
    });
    await onLogin.emit({ userId: 'u1' });
    expect(received).toBe('u1');
    off();
  });
});
