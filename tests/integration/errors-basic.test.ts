import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';
import { defineErrors } from '@errors';

describe('ErrorBus basic', () => {
  it('emits and receives errors with metadata', async () => {
    const kernel = createKernel().build();
    await kernel.init();

    const CustomErrors = defineErrors('custom', { TypeX: (p: { code: number }) => p });
    const { TypeX } = CustomErrors.factories;

    let received: { payload: unknown; meta?: unknown } | null = null;
    const off = kernel.errors.on(TypeX, (payload, meta) => {
      received = { payload, meta };
    });

    await kernel.errors.report(TypeX({ code: 42 }), { source: 'custom' });

    const r = received as { payload: unknown; meta?: { source?: string } } | null;
    expect(r?.payload).toEqual({ code: 42 });
    expect(r?.meta?.source).toBe('custom');
    off();
  });
});
