/**
 * @file Unit tests for LifecycleEvents emitter.
 */
import { describe, it, expect, vi } from 'vitest';
import { LifecycleEvents } from '@lifecycle/lifecycle-events';

describe('LifecycleEvents', () => {
  it('on/emit/off per event type', async () => {
    const ev = new LifecycleEvents();
    const spy = vi.fn((v: unknown): void => {
      expect(typeof v === 'object' || typeof v === 'undefined').toBe(true);
    });
    const off = ev.on('pluginLoaded', spy as (p: { name: string }) => void);
    await ev.emit('pluginLoaded', { name: 'a' });
    off();
    await ev.emit('pluginLoaded', { name: 'b' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('freezes plain objects shallowly', async () => {
    const ev = new LifecycleEvents();
    const s = vi.fn((p: { name: string; error: unknown }): void => {
      expect(Object.isFrozen(p)).toBe(true);
      // error is unknown (non-plain like Error) should not be frozen by shallow logic
      expect(Object.isFrozen(p.error as object)).toBe(false);
    });
    ev.on('pluginFailed', s as (p: { name: string; error: unknown }) => void);
    await ev.emit('pluginFailed', { name: 'a', error: new Error('e') });
    expect(s).toHaveBeenCalledTimes(1);
  });
});
