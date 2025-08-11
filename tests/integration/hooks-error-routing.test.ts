import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';
import { definePlugin } from '@plugin/definePlugin';
import { defineErrors } from '@errors';

describe('HookBus → ErrorBus routing', () => {
  it('routes handler exceptions to ErrorBus with metadata', async () => {
    const P = definePlugin({
      name: 'p',
      version: '1.0.0',
      hooks: {
        boom: {
          on: 0 as unknown as unknown,
          off: 0 as unknown as unknown,
          emit: 0 as unknown as unknown,
          once: 0 as unknown as unknown,
        },
      } as unknown as Record<string, { on: unknown; off: unknown; emit: unknown; once: unknown }>,
      async setup() {
        return {};
      },
    });

    const kernel = createKernel().use(P).build();
    await kernel.init();

    const h = kernel.hooks.get<unknown>('p.boom')!;
    const HooksErrors = defineErrors('hooks', { HandlerError: (e: unknown) => e });
    const { HandlerError } = HooksErrors.factories;
    let routed = false;
    const off = kernel.errors.on(HandlerError, (_e, meta) => {
      routed = meta?.eventName === 'p.boom';
    });

    h.on(() => {
      throw new Error('boom');
    });
    await h.emit({});
    await Promise.resolve();

    expect(routed).toBe(true);
    off();
  });
});
