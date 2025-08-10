import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';
import type { PluginInstance } from '@types';

describe('KernelErrors integration', () => {
  it('emits DependencyMissing and DependencyVersionUnsatisfied on order resolution', async () => {
    class Core implements PluginInstance {
      metadata = { name: 'core', version: '1.0.0' } as const;
      [k: symbol]: unknown;
    }
    class Feature implements PluginInstance {
      metadata = {
        name: 'feature',
        version: '1.0.0',
        dependencies: [{ name: 'core', version: '^2.0.0' }],
      } as const;
      [k: symbol]: unknown;
    }

    // Missing dependency
    const kernel1 = createKernel().use(Feature).build();
    await expect(kernel1.init()).rejects.toThrowError(/DependencyMissing|requires dependency/);

    // Unsatisfied version constraint
    const kernel2 = createKernel().use(Core).use(Feature).build();
    await expect(kernel2.init()).rejects.toThrowError(
      /DependencyVersionUnsatisfied|requires 'core' version/
    );
  });

  it('wraps lifecycle phase failures', async () => {
    class Bad implements PluginInstance {
      metadata = { name: 'bad', version: '1.0.0' } as const;
      [k: symbol]: unknown;
      async init(): Promise<void> {
        throw new Error('boom');
      }
    }

    const kernel = createKernel().use(Bad).build();
    await expect(kernel.init()).rejects.toMatchObject({
      name: 'KernelError',
      code: 'LifecyclePhaseFailed',
    });
  });
});
