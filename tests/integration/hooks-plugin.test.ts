import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';
import { definePlugin } from '@plugin/definePlugin';
import { hook } from '@hooks/hook';

describe('Plugin-declared hooks registration', () => {
  it('registers namespaced hooks and allows emitting/consuming', async () => {
    const Auth = definePlugin({
      name: 'auth',
      version: '1.0.0',
      hooks: {
        onLogin: hook<{ userId: string }>(),
      },
      async setup() {
        return {};
      },
    });

    const kernel = createKernel().use(Auth).build();
    await kernel.init();

    const onLogin = kernel.hooks.get<{ userId: string }>('auth.onLogin')!;
    let uid: string | null = null;
    const off = onLogin.on(p => {
      uid = p.userId;
    });
    await onLogin.emit({ userId: 'u1' });
    expect(uid).toBe('u1');
    off();
  });
});
