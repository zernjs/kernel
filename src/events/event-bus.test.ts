/**
 * @file Unit tests for EventBus, SimpleEvent behaviors, middlewares and adapters.
 */
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '@events/event-bus';
import type { EventAdapter, EventContext } from '@types';

function createAdapterSpies(): {
  adapter: EventAdapter;
  calls: {
    start: number;
    namespaces: string[];
    defines: Array<[string, string]>;
    emits: Array<[string, string, unknown]>;
  };
} {
  const calls = {
    start: 0,
    namespaces: [] as string[],
    defines: [] as Array<[string, string]>,
    emits: [] as Array<[string, string, unknown]>,
  };
  const adapter: EventAdapter = {
    name: 'spy',
    onStart: (): void => {
      calls.start += 1;
    },
    onNamespace: (ns: string): void => {
      calls.namespaces.push(ns);
    },
    onDefine: (ns: string, ev: string): void => {
      calls.defines.push([ns, ev]);
    },
    onEmit: (ns: string, ev: string, payload: unknown): void => {
      calls.emits.push([ns, ev, payload]);
    },
  };
  return { adapter, calls };
}

describe('SimpleEvent delivery and startup behavior (via EventBus)', () => {
  it('sync delivery calls handlers before await resolves', async () => {
    const bus = new EventBus();
    const ns = bus.namespace('ui');
    const ev = ns.define<number>('Sync', { delivery: 'sync' });
    bus.start();
    const order: string[] = [];
    ev.on((_p): void => {
      order.push('handler');
    });
    await ev.emit(1);
    order.push('after');
    expect(order).toEqual(['handler', 'after']);
  });

  it('microtask/async delivery schedules handler after call stack; do not await emit', async () => {
    const modes: Array<'microtask' | 'async'> = ['microtask', 'async'];
    for (const mode of modes) {
      const bus = new EventBus();
      const ns = bus.namespace('ui');
      const ev = ns.define<number>('Later', { delivery: mode });
      bus.start();
      const order: string[] = [];
      ev.on((_p): void => {
        order.push('handler');
      });
      // Do not await emit: handler should run in a microtask
      void ev.emit(1);
      order.push('after');
      await Promise.resolve();
      expect(order).toEqual(['after', 'handler']);
    }
  });

  it('drop startup: emits before start are ignored', async () => {
    const bus = new EventBus();
    const ev = bus.namespace('s').define<number>('Drop', { startup: 'drop' });
    const received: number[] = [];
    await ev.emit(1); // not ready -> dropped
    bus.start();
    ev.on((v): void => {
      received.push(v);
    });
    await ev.emit(2);
    expect(received).toEqual([2]);
  });

  it('buffer startup: buffers up to bufferSize before start then flushes on start', async () => {
    const bus = new EventBus();
    const ev = bus.namespace('s').define<number>('Buf', { startup: 'buffer', bufferSize: 1 });
    await ev.emit(1);
    await ev.emit(2); // truncated by bufferSize=1
    const got: number[] = [];
    ev.on((v): void => {
      got.push(v);
    });
    bus.start();
    // first buffered emitted on start, and then subsequent emits are delivered normally
    await ev.emit(3);
    expect(got).toEqual([1, 3]);
  });

  it('sticky startup: stores latest pre-ready value and delivers to new subscribers after start', async () => {
    const bus = new EventBus();
    const ev = bus.namespace('s').define<number>('Sticky', { startup: 'sticky', delivery: 'sync' });
    await ev.emit(5);
    bus.start();
    const got: number[] = [];
    ev.on((v): void => {
      got.push(v);
    });
    // sticky value delivered once to subscriber at subscription time
    expect(got).toEqual([5]);
    await ev.emit(6);
    expect(got).toEqual([5, 6]);
  });

  it('once resolves with next emitted value', async () => {
    const bus = new EventBus();
    const ev = bus.namespace('n').define<string>('Once');
    bus.start();
    const p = ev.once();
    await ev.emit('x');
    await expect(p).resolves.toBe('x');
  });

  it('freezes plain object payloads for handlers but adapters see original', async () => {
    const bus = new EventBus();
    const { adapter, calls } = createAdapterSpies();
    bus.useAdapter(adapter);
    const ns = bus.namespace('d');
    const ev = ns.define<{ a: number }>('Freeze', { delivery: 'sync' });
    bus.start();
    const h = vi.fn((p: { a: number }) => {
      expect(Object.isFrozen(p)).toBe(true);
    });
    ev.on(h);
    const payload = { a: 1 };
    await ns.emit('Freeze', payload);
    expect(h).toHaveBeenCalledTimes(1);
    // adapter received the raw payload reference
    expect(calls.emits[0]?.[2]).toBe(payload);
  });
});

describe('Namespace API behavior and middleware ordering', () => {
  it('namespace.on/emit create event lazily when missing', async () => {
    const bus = new EventBus();
    const ns = bus.namespace('lazy');
    const handler = vi.fn((v: number) => {
      expect(v).toBe(1);
    });
    const off = ns.on('E', handler);
    bus.start();
    await ns.emit('E', 1);
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it('global -> namespace -> event middlewares run in order', async () => {
    const bus = new EventBus();
    const ns = bus.namespace('m');
    const ev = ns.define<number>('A');
    const order: string[] = [];

    bus.use(async (_ctx: EventContext, next: () => Promise<void>): Promise<void> => {
      order.push('global');
      await next();
    });
    ns.use(async (_ctx: EventContext, next: () => Promise<void>): Promise<void> => {
      order.push('namespace');
      await next();
    });
    ev.use?.(async (_ctx: EventContext, next: () => Promise<void>): Promise<void> => {
      order.push('event');
      await next();
    });

    bus.start();
    const h = vi.fn((_v: number) => {
      order.push('handler');
    });
    ev.on(h);
    await ns.emit('A', 1);
    expect(order).toEqual(['global', 'namespace', 'event', 'handler']);
  });
});

describe('Adapters integration', () => {
  it('fires adapter hooks onStart/onNamespace/onDefine/onEmit appropriately', async () => {
    const bus = new EventBus();
    const { adapter, calls } = createAdapterSpies();
    bus.useAdapter(adapter);
    const ns = bus.namespace('x');
    const ev = ns.define<number>('Y');

    expect(calls.namespaces).toEqual(['x']);
    expect(calls.defines).toEqual([['x', 'Y']]);

    bus.start();
    expect(calls.start).toBe(1);

    ev.on((_v: number) => {});
    await ns.emit('Y', 7);
    expect(calls.emits[0]).toEqual(['x', 'Y', 7]);
  });
});
