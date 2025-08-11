/**
 * @file Unit tests for `AlertBus` and helpers.
 * @module alerts/alert-bus.test
 * @remarks
 * - Verifies subscribe/unsubscribe behavior, payload freezing semantics,
 *   channel dispatch propagation, async ordering guarantees, and helpers:
 *   `defineAlert`, `createAlerts`, `bindAlerts`.
 */

import { describe, it, expect, vi } from 'vitest';
import { AlertBus, defineAlert, createAlerts, bindAlerts } from '@alerts/alert-bus';
import type { IAlertChannel } from '@types';

describe('AlertBus', () => {
  it('subscribes and emits to handler', async () => {
    const bus = new AlertBus();
    const handler = vi.fn<(payload: number) => void | Promise<void>>();

    bus.on<number>('ui', 'Count', handler);
    await bus.emit<number>('ui', 'Count', 42);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(42);
  });

  it('unsubscribe stops receiving alerts', async () => {
    const bus = new AlertBus();
    const handler = vi.fn<(payload: string) => void | Promise<void>>();

    const off = bus.on<string>('sys', 'Ping', handler);
    await bus.emit<string>('sys', 'Ping', 'a');
    off();
    await bus.emit<string>('sys', 'Ping', 'b');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith('a');
  });

  it('freezes plain object payloads', async () => {
    const bus = new AlertBus();

    const objHandler = vi.fn((p: { a: number }) => {
      expect(Object.isFrozen(p)).toBe(true);
      expect(p.a).toBe(1);
    });

    bus.on('app', 'Obj', objHandler);
    await bus.emit('app', 'Obj', { a: 1 });

    expect(objHandler).toHaveBeenCalledTimes(1);
  });

  it('does not freeze non-plain payloads (Array, Date)', async () => {
    const bus = new AlertBus();

    const arrayHandler = vi.fn((p: number[]) => {
      expect(Array.isArray(p)).toBe(true);
      expect(Object.isFrozen(p)).toBe(false);
    });
    const dateHandler = vi.fn((p: Date) => {
      expect(p instanceof Date).toBe(true);
      expect(Object.isFrozen(p)).toBe(false);
    });

    bus.on('app', 'Array', arrayHandler);
    bus.on('app', 'Date', dateHandler);

    await bus.emit('app', 'Array', [1, 2, 3]);
    await bus.emit('app', 'Date', new Date());

    expect(arrayHandler).toHaveBeenCalledTimes(1);
    expect(dateHandler).toHaveBeenCalledTimes(1);
  });

  it('dispatches to registered channels (no handlers)', async () => {
    const bus = new AlertBus();
    const dispatched: Array<[string, string, unknown]> = [];

    const channel: IAlertChannel = {
      dispatch: vi.fn((ns: string, kind: string, payload: unknown) => {
        dispatched.push([ns, kind, payload]);
      }),
    };

    bus.useChannel(channel);
    await bus.emit('ops', 'Notify', { x: 1 });

    expect(channel.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatched[0]?.[0]).toBe('ops');
    expect(dispatched[0]?.[1]).toBe('Notify');
    expect(Object.isFrozen(dispatched[0]?.[2] as object)).toBe(true);
  });

  it('invokes all handlers and then channels, awaiting async handlers', async () => {
    const bus = new AlertBus();
    const order: string[] = [];

    const h1 = vi.fn(async (_p: number) => {
      await new Promise(r => setTimeout(r, 10));
      order.push('h1');
    });
    const h2 = vi.fn((_p: number) => {
      order.push('h2');
    });

    const channel: IAlertChannel = {
      dispatch: vi.fn((_ns, _kind, _payload) => {
        order.push('ch');
      }),
    };

    bus.on('ui', 'Tick', h1);
    bus.on('ui', 'Tick', h2);
    bus.useChannel(channel);

    await bus.emit('ui', 'Tick', 1);

    expect(order).toEqual(['h1', 'h2', 'ch']);
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
    expect(channel.dispatch).toHaveBeenCalledTimes(1);
  });
});

describe('alert helpers', () => {
  it('defineAlert and createAlerts produce namespace and kinds', () => {
    const spec = {
      Info: defineAlert(),
      Warn: defineAlert(),
    };

    const { namespace, kinds } = createAlerts('ui', spec);

    expect(namespace).toBe('ui');
    expect(kinds).toEqual(['Info', 'Warn']);
  });

  it('bindAlerts emits and subscribes restricted to declared kinds', async () => {
    const bus = new AlertBus();

    const spec = {
      Info: defineAlert(),
      Warn: defineAlert(),
    };
    const { namespace, kinds } = createAlerts('ui', spec);
    expect(namespace).toBe('ui');
    expect(kinds).toEqual(['Info', 'Warn']);

    const helpers = bindAlerts(bus, namespace, spec);

    const infoHandler = vi.fn((p: { msg: string }) => {
      expect(p.msg).toBe('hello');
      expect(Object.isFrozen(p)).toBe(true);
    });

    const off = helpers.on('Info', infoHandler);
    await helpers.emit('Info', { msg: 'hello' });

    expect(infoHandler).toHaveBeenCalledTimes(1);

    off();
    await helpers.emit('Info', { msg: 'again' });
    expect(infoHandler).toHaveBeenCalledTimes(1);
  });

  it('off is safe when handler does not exist', async () => {
    const bus = new AlertBus();
    const h: (payload: unknown) => void = vi.fn();
    expect(() => bus.off('ns', 'kind', h)).not.toThrow();
    await bus.emit('ns', 'kind', 1);
    expect(h).not.toHaveBeenCalled();
  });

  it('does not duplicate calls when same handler is registered twice', async () => {
    const bus = new AlertBus();
    const h = vi.fn((_p: number) => {});
    bus.on('ui', 'X', h);
    bus.on('ui', 'X', h);
    await bus.emit('ui', 'X', 1);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('awaits async channels and preserves registration order', async () => {
    const bus = new AlertBus();
    const order: string[] = [];
    const ch1: IAlertChannel = {
      dispatch: vi.fn(async () => {
        await new Promise(r => setTimeout(r, 5));
        order.push('ch1');
      }),
    };
    const ch2: IAlertChannel = {
      dispatch: vi.fn(() => {
        order.push('ch2');
      }),
    };
    bus.useChannel(ch1);
    bus.useChannel(ch2);
    await bus.emit('ns', 'K', 0);
    expect(order).toEqual(['ch1', 'ch2']);
    expect(ch1.dispatch).toHaveBeenCalledTimes(1);
    expect(ch2.dispatch).toHaveBeenCalledTimes(1);
  });

  it('passes the same payload reference to handlers and channels', async () => {
    const bus = new AlertBus();
    let handlerRef: unknown;
    let channelRef: unknown;
    const h = vi.fn((p: { a: number }) => {
      handlerRef = p;
    });
    const ch: IAlertChannel = {
      dispatch: vi.fn((_ns, _k, p) => {
        channelRef = p;
      }),
    };
    bus.on('ns', 'Ref', h);
    bus.useChannel(ch);
    const payload = { a: 1 };
    await bus.emit('ns', 'Ref', payload);
    expect(handlerRef).toBe(channelRef);
  });

  it('freezes plain object with null prototype', async () => {
    const bus = new AlertBus();
    const h = vi.fn((p: Record<string, unknown>) => {
      expect(Object.getPrototypeOf(p)).toBe(null);
      expect(Object.isFrozen(p)).toBe(true);
    });
    bus.on('ns', 'NullProto', h);
    const payload = Object.create(null);
    await bus.emit('ns', 'NullProto', payload);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('freezing is shallow: nested objects remain mutable', async () => {
    const bus = new AlertBus();
    const h = vi.fn((p: { nested: { x: number } }) => {
      expect(Object.isFrozen(p)).toBe(true);
      expect(Object.isFrozen(p.nested)).toBe(false);
    });
    const payload = { nested: { x: 1 } };
    bus.on('ns', 'Shallow', h);
    await bus.emit('ns', 'Shallow', payload);
    payload.nested.x = 2; // mutable
    expect(payload.nested.x).toBe(2);
  });

  it('unsubscribing one of many keeps others active', async () => {
    const bus = new AlertBus();
    const h1 = vi.fn((_p: number) => {});
    const h2 = vi.fn((_p: number) => {});
    const off1 = bus.on('ns', 'M', h1);
    bus.on('ns', 'M', h2);
    off1();
    await bus.emit('ns', 'M', 1);
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('off function is idempotent', async () => {
    const bus = new AlertBus();
    const h = vi.fn((_p: number) => {});
    const off = bus.on('ns', 'Idem', h);
    off();
    off(); // repeated call should not fail
    await bus.emit('ns', 'Idem', 1);
    expect(h).not.toHaveBeenCalled();
  });
});
