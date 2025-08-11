/**
 * @file Unit tests for definePlugin helper.
 */
import { describe, it, expect } from 'vitest';
import { definePlugin } from '@plugin/definePlugin';
import type { PluginSpec } from '@types';

describe('definePlugin', () => {
  it('creates a plugin constructor with metadata and setup symbol', async () => {
    const spec: PluginSpec<
      'auth',
      { login: (u: string) => string },
      readonly [],
      Record<string, object>
    > = {
      name: 'auth',
      version: '1.0.0',
      description: 'auth plugin',
      setup: () => ({ login: (u: string): string => `ok:${u}` }),
    };
    const P = definePlugin(spec as unknown as PluginSpec);

    const instance = new P();
    expect(instance.metadata).toMatchObject({
      name: 'auth',
      version: '1.0.0',
      description: 'auth plugin',
    });
    const setupKey = Symbol.for('zern.plugin.setup') as unknown as PropertyKey;
    const setupProp = (instance as unknown as Record<PropertyKey, unknown>)[setupKey];
    expect(typeof setupProp).toBe('function');
    type SetupFn = (ctx: unknown, options?: unknown) => { login: (u: string) => string };
    const api = (setupProp as SetupFn)({});
    expect(api.login('u1')).toBe('ok:u1');
  });

  it('exposes static dependsOn is normalized', () => {
    const Core = definePlugin({
      name: 'core',
      version: '1.0.0',
      setup: () => ({}),
    } as unknown as PluginSpec);
    const spec2: PluginSpec<'svc', object, readonly [], Record<string, object>> = {
      name: 'svc',
      version: '1.0.0',
      dependsOn: [Core] as unknown as readonly [],
      setup: () => ({}),
    };
    const P = definePlugin(spec2 as unknown as PluginSpec);
    expect(Array.isArray((P as unknown as { dependsOn: unknown[] }).dependsOn)).toBe(true);
  });
});
