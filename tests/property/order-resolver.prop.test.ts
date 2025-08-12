// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest" />

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { definePlugin } from '@plugin/definePlugin';
import { resolvePluginOrder } from '@resolver/order-resolver';
import type { PluginInstance } from '@types';

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
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 8 }),
        (names: string[]) => {
          const ctors = names.map(n => makePlugin(n));
          const instances = ctors.map(C => new C());
          const resolved = resolvePluginOrder({ plugins: instances, userOrder: {} });

          const inputSet = new Set(instances.map(p => p.metadata.name));
          const outSet = new Set(resolved.map(p => p.metadata.name));
          expect(outSet).toEqual(inputSet);
          expect(resolved.length).toBe(inputSet.size);
        }
      )
    );
  });
});
