// zern-kernel/tests/property/order-resolver.prop.test.ts
import fc from 'fast-check';
import { definePlugin } from '../src/plugin/definePlugin';
import { resolvePluginOrder } from '../src/resolve/order-resolver';
import type { PluginInstance } from '../src/types';

function makePlugin(name: string): new () => PluginInstance {
  return definePlugin({
    name,
    version: '1.0.0',
    async setup() {
      return {};
    },
  }) as unknown as new () => PluginInstance;
}

describe('order-resolver property tests', () => {
  it('no loss of membership and no duplicates', () => {
    fc.assert(
      fc.property(fc.set(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 8 }), names => {
        const ctors = names.map(makePlugin);
        const instances = ctors.map(C => new C());
        const resolved = resolvePluginOrder({ plugins: instances, userOrder: {} });
        const inputSet = new Set(instances.map(p => p.metadata.name));
        const outSet = new Set(resolved.map(p => p.metadata.name));
        expect(outSet).toEqual(inputSet);
        expect(resolved.length).toBe(inputSet.size);
      })
    );
  });
});
