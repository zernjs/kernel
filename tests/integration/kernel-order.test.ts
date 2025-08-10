import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';
import type { PluginInstance } from '@types';

class A implements PluginInstance {
  metadata = { name: 'A', version: '1.0.0' } as const;
  [k: symbol]: unknown;
}
class B implements PluginInstance {
  metadata = { name: 'B', version: '1.0.0' } as const;
  [k: symbol]: unknown;
}
class C implements PluginInstance {
  metadata = { name: 'C', version: '1.0.0' } as const;
  [k: symbol]: unknown;
}

describe('order resolver', () => {
  it('respects user before/after constraints', async () => {
    const kernel = createKernel()
      .use(A)
      .use(B, { after: ['A'] })
      .use(C, { before: ['B'] })
      .build();

    await kernel.init();
    const order = kernel.loadedPlugins;
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('B'));
  });

  it('applies plugin load hints when no user constraints conflict', async () => {
    class P1 implements PluginInstance {
      metadata = { name: 'P1', version: '1.0.0', loadAfter: ['P2'] } as const;
      [k: symbol]: unknown;
    }
    class P2 implements PluginInstance {
      metadata = { name: 'P2', version: '1.0.0' } as const;
      [k: symbol]: unknown;
    }

    const kernel = createKernel().use(P1).use(P2).build();
    await kernel.init();
    const order = kernel.loadedPlugins;
    expect(order.indexOf('P2')).toBeLessThan(order.indexOf('P1'));
  });

  it('validates missing dependencies and throws when required is absent', async () => {
    class Feature implements PluginInstance {
      // declare dependency in metadata shape used by definePlugin
      metadata = { name: 'feature', version: '1.0.0', dependencies: [{ name: 'core' }] } as const;
      [k: symbol]: unknown;
    }

    const kernel = createKernel().use(Feature).build();
    await expect(kernel.init()).rejects.toThrow(/requires dependency 'core'/);
  });

  it('validates semver ranges for dependencies', async () => {
    class Core2 implements PluginInstance {
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

    const kernel = createKernel().use(Core2).use(Feature).build();
    await expect(kernel.init()).rejects.toThrow(/requires 'core' version/);
  });
});
