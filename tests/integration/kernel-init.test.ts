import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';

describe('Kernel integration - init', () => {
  it('creates a kernel and initializes without errors', async (): Promise<void> => {
    const kernel = createKernel().build();
    expect(typeof kernel.init).toBe('function');
    await expect(kernel.init()).resolves.toBeUndefined();
  });
});
