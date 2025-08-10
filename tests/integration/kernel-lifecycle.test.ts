import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';
import type { PluginInstance } from '@types';

class L implements PluginInstance {
  metadata = { name: 'L', version: '1.0.0' } as const;
  [k: symbol]: unknown;
  async beforeInit(): Promise<void> {}
  async init(): Promise<void> {}
  async afterInit(): Promise<void> {}
  async beforeDestroy(): Promise<void> {}
  async destroy(): Promise<void> {}
  async afterDestroy(): Promise<void> {}
}

describe('lifecycle engine', () => {
  it('runs init phases and then destroy phases without error', async () => {
    const kernel = createKernel().use(L).build();
    await expect(kernel.init()).resolves.toBeUndefined();
    expect(kernel.loadedPlugins).toContain('L');
    await expect(kernel.destroy()).resolves.toBeUndefined();
    expect(kernel.loadedPlugins.length).toBe(0);
  });
});
