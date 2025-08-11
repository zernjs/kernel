/**
 * @file Unit tests for plugin descriptors helpers.
 */
import { describe, it, expect } from 'vitest';
import { createPluginMetadata, isDetailed, toDependencyRecord } from '@plugin/descriptors';
import type { PluginCtor, PluginSpec, DepItem } from '@types';

function makePluginCtor(name: string): PluginCtor<string, object> {
  return class P {
    public readonly metadata = { name, version: '1.0.0' } as const;
  } as unknown as PluginCtor<string, object>;
}

describe('descriptors', () => {
  it('isDetailed detects detailed dep', () => {
    const P = makePluginCtor('A');
    expect(isDetailed({ plugin: P })).toBe(true);
    expect(isDetailed(P)).toBe(false);
  });

  it('toDependencyRecord produces name/version/optional from dep item', () => {
    const P = makePluginCtor('A');
    expect(toDependencyRecord(P)).toEqual({ name: 'A' });
    expect(toDependencyRecord({ plugin: P, version: '^1.0.0' })).toEqual({
      name: 'A',
      version: '^1.0.0',
      optional: undefined,
    });
    expect(toDependencyRecord({ plugin: P, optional: true })).toEqual({
      name: 'A',
      optional: true,
    });
  });

  it('createPluginMetadata normalizes spec fields', () => {
    const A = makePluginCtor('A');
    const spec: PluginSpec<'core', object, readonly DepItem[], Record<string, object>> = {
      name: 'core',
      version: '1.2.3',
      description: 'desc',
      loadBefore: ['x'],
      loadAfter: ['y'],
      dependsOn: [A, { plugin: A, version: '^1', optional: true }],
      setup: () => ({}),
    };
    const meta = createPluginMetadata(spec);
    expect(meta).toMatchObject({
      name: 'core',
      version: '1.2.3',
      description: 'desc',
      loadBefore: ['x'],
      loadAfter: ['y'],
    });
    expect(meta.dependencies).toEqual([
      { name: 'A' },
      { name: 'A', version: '^1', optional: true },
    ]);
  });
});
