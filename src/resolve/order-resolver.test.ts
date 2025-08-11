/**
 * @file Unit tests for resolvePluginOrder.
 */
import { describe, it, expect } from 'vitest';
import { resolvePluginOrder } from '@resolver/order-resolver';
import { KernelError } from '@errors';
import type { PluginInstance, UserOrderMap } from '@types';

function plugin(
  name: string,
  version = '1.0.0',
  meta?: Partial<PluginInstance['metadata']>
): PluginInstance {
  return { metadata: { name, version, ...(meta ?? {}) } } as PluginInstance;
}

function ctorFrom(instance: PluginInstance): new () => PluginInstance {
  // Minimal class whose metadata matches the provided instance
  return class P {
    public readonly metadata = instance.metadata;
  } as unknown as new () => PluginInstance;
}

describe('resolvePluginOrder', () => {
  it('orders by dependencies, user rules, and hints', () => {
    const A = plugin('A');
    const B = plugin('B');
    const C = plugin('C');
    const D = plugin('D');
    (C.metadata as unknown as { loadBefore?: string[] }).loadBefore = ['D'];

    // declare dependsOn for B -> A
    (B as unknown as { constructor: { dependsOn?: Array<new () => PluginInstance> } }).constructor =
      class {} as unknown as { dependsOn?: Array<new () => PluginInstance> };
    (
      B as unknown as { constructor: { dependsOn?: Array<new () => PluginInstance> } }
    ).constructor.dependsOn = [ctorFrom(A)];

    const userOrder: UserOrderMap = { C: { before: ['D'] } };
    const ordered = resolvePluginOrder({ plugins: [D, C, B, A], userOrder });
    // Prefer comparator preserves input order when no constraints between items
    expect(ordered.map(p => p.metadata.name)).toEqual(['C', 'D', 'A', 'B']);
  });

  it('throws KernelError DependencyCycle when topo sort fails', () => {
    const A = plugin('A');
    const B = plugin('B');
    // create mutual dependency via dependsOn metadata
    (A as unknown as { constructor: { dependsOn?: Array<new () => PluginInstance> } }).constructor =
      class {} as unknown as { dependsOn?: Array<new () => PluginInstance> };
    (B as unknown as { constructor: { dependsOn?: Array<new () => PluginInstance> } }).constructor =
      class {} as unknown as { dependsOn?: Array<new () => PluginInstance> };
    (
      A as unknown as { constructor: { dependsOn?: Array<new () => PluginInstance> } }
    ).constructor.dependsOn = [ctorFrom(B)];
    (
      B as unknown as { constructor: { dependsOn?: Array<new () => PluginInstance> } }
    ).constructor.dependsOn = [ctorFrom(A)];

    expect(() => resolvePluginOrder({ plugins: [A, B], userOrder: {} })).toThrow(KernelError);
  });

  it('validates declared dependencies: missing, version unsatisfied, invalid specs', () => {
    const A = plugin('A', '1.0.0');
    const B = plugin('B', '1.0.0');
    (
      B.metadata as unknown as {
        dependencies?: Array<{ name: string; version?: string; optional?: boolean }>;
      }
    ).dependencies = [{ name: 'A', version: '^2.0.0' }];
    const C = plugin('C', 'invalid'); // invalid actual
    const D = plugin('D', '1.0.0'); // missing non-optional
    (
      D.metadata as unknown as {
        dependencies?: Array<{ name: string; version?: string; optional?: boolean }>;
      }
    ).dependencies = [{ name: 'X' }];
    const E = plugin('E', '1.0.0'); // invalid range
    (
      E.metadata as unknown as {
        dependencies?: Array<{ name: string; version?: string; optional?: boolean }>;
      }
    ).dependencies = [{ name: 'A', version: 'v1.0.0' }];

    // Missing dependency should throw
    try {
      resolvePluginOrder({ plugins: [A, D], userOrder: {} });
      expect.unreachable('should have thrown');
    } catch (e) {
      const err = e as { code?: string };
      expect(err).toBeInstanceOf(KernelError);
      expect(err.code).toBe('DependencyMissing');
    }

    // Version unsatisfied should throw
    try {
      resolvePluginOrder({ plugins: [A, B], userOrder: {} });
      expect.unreachable('should have thrown');
    } catch (e) {
      const err = e as { code?: string };
      expect(err).toBeInstanceOf(KernelError);
      expect(err.code).toBe('DependencyVersionUnsatisfied');
    }

    // Invalid actual semver should throw InvalidVersionSpec (actual)
    const F = plugin('F', '1.0.0');
    (
      F.metadata as unknown as {
        dependencies?: Array<{ name: string; version?: string; optional?: boolean }>;
      }
    ).dependencies = [{ name: 'C', version: '^1.0.0' }];
    try {
      resolvePluginOrder({ plugins: [C, F], userOrder: {} });
      expect.unreachable('should have thrown');
    } catch (e) {
      const err = e as { code?: string };
      expect(err).toBeInstanceOf(KernelError);
      expect(err.code).toBe('InvalidVersionSpec');
    }

    // Range without operator is treated as exact match; not a parse error: unsatisfied
    try {
      resolvePluginOrder({ plugins: [E, A], userOrder: {} });
      expect.unreachable('should have thrown');
    } catch (e) {
      const err = e as { code?: string };
      expect(err).toBeInstanceOf(KernelError);
      expect(err.code).toBe('DependencyVersionUnsatisfied');
    }
  });
});
