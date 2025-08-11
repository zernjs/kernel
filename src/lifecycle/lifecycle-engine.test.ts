/**
 * @file Unit tests for LifecycleEngine.
 */
import { describe, it, expect } from 'vitest';
import { LifecycleEngine } from '@lifecycle/lifecycle-engine';
import { lifecyclePhaseFailed } from '@errors';
import type { PluginInstance } from '@types';

type TestPluginInstance = {
  metadata: { name: string; version: string };
  beforeInit?: (self: unknown, kernel: unknown) => Promise<void> | void;
  init?: (self: unknown, kernel: unknown) => Promise<void> | void;
  afterInit?: (self: unknown, kernel: unknown) => Promise<void> | void;
};

function plugin(name: string, methods: Partial<TestPluginInstance> = {}): TestPluginInstance {
  return { metadata: { name, version: '1.0.0' }, ...methods };
}

describe('LifecycleEngine', () => {
  it('runs phase functions in parallel up to concurrency', async () => {
    const calls: string[] = [];
    const p1 = plugin('a', {
      init: async () => {
        calls.push('a');
      },
    });
    const p2 = plugin('b', {
      init: async () => {
        calls.push('b');
      },
    });
    const engine = new LifecycleEngine({ concurrency: 2 });
    await engine.runPhase(
      'init',
      [p1 as unknown as PluginInstance, p2 as unknown as PluginInstance],
      {}
    );
    expect(calls.sort()).toEqual(['a', 'b']);
  });

  it('skips plugins without the phase method', async () => {
    const p1 = plugin('a', { init: async () => {} });
    const p2 = plugin('b', {});
    const engine = new LifecycleEngine({ concurrency: 2 });
    await expect(
      engine.runPhase(
        'init',
        [p1 as unknown as PluginInstance, p2 as unknown as PluginInstance],
        {}
      )
    ).resolves.toBeUndefined();
  });

  it('wraps errors with lifecyclePhaseFailed', async () => {
    const p1 = plugin('a', {
      init: async () => {
        throw new Error('boom');
      },
    });
    const engine = new LifecycleEngine({ concurrency: 1 });
    await expect(
      engine.runPhase('init', [p1 as unknown as PluginInstance], {})
    ).rejects.toMatchObject(lifecyclePhaseFailed('a', 'init', new Error('boom')));
  });
});
