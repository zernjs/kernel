/**
 * @file Unit tests for HookBus with utilities and error routing.
 */
import { describe, it, expect, vi } from 'vitest';
import { HookBus } from '@hooks/hook-bus';
import { ErrorBus, defineErrors } from '@errors';

describe('HookBus', () => {
  it('define/get and basic on/emit/off', async () => {
    const hb = new HookBus();
    const hk = hb.define<number>('value');
    const spy = vi.fn((_v: number): void => {});
    const off = hk.on(spy);
    await hk.emit(1);
    off();
    await hk.emit(2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('get returns undefined for unknown and instance for defined hook', () => {
    const hb = new HookBus();
    expect(hb.get<number>('missing')).toBeUndefined();
    hb.define<number>('v');
    expect(hb.get<number>('v')).toBeDefined();
  });

  it('debounce utility wraps on() to debounce handler calls', async () => {
    vi.useFakeTimers();
    const hb = new HookBus();
    const hk = hb.define<number>('debounced').debounce(50);
    const spy = vi.fn((_v: number): void => {});
    hk.on(spy);
    void hk.emit(1);
    void hk.emit(2);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('throttle utility wraps on() to throttle handler calls', async () => {
    vi.useFakeTimers();
    const hb = new HookBus();
    const hk = hb.define<number>('throttled').throttle(100);
    const spy = vi.fn((_v: number): void => {});
    hk.on(spy);
    void hk.emit(1);
    void hk.emit(2);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    void hk.emit(3);
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('reports handler errors to ErrorBus using hooks namespace/factory', async () => {
    const errorBus = new ErrorBus();
    const hb = new HookBus(errorBus);

    // Subscribe to the error bus using the factories created by HookBus
    const HooksErrors = defineErrors('hooks', { HandlerError: (e: unknown) => e });
    const received: unknown[] = [];
    errorBus.on(HooksErrors.factories.HandlerError, (payload): void => {
      received.push(payload);
    });

    const hk = hb.define<number>('E');
    hk.on((_v: number): void => {
      throw new Error('boom');
    });
    await hk.emit(1);

    expect(received.length).toBe(1);
    expect((received[0] as Error).message).toBe('boom');
  });
});
