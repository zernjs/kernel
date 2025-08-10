import type { Event, EventOptions, DeliveryMode, StartupMode } from '@types';
import { isPlainObject, debounce, throttle } from '@utils';

class SimpleEvent<Payload> implements Event<Payload> {
  private handlers = new Set<(p: Payload) => void | Promise<void>>();
  private readonly delivery: DeliveryMode;
  private readonly startup: StartupMode;
  private readonly bufferSize: number;
  private ready = false;
  private stickyValue: Payload | undefined;
  private buffer: Payload[] = [];
  private readonly onHandlerError?: (err: unknown) => void;

  constructor(opts?: EventOptions, onHandlerError?: (err: unknown) => void) {
    this.delivery = opts?.delivery ?? 'microtask';
    this.startup = opts?.startup ?? 'drop';
    this.bufferSize = Math.max(0, opts?.bufferSize ?? 0);
    this.onHandlerError = onHandlerError;
  }

  markReady(): void {
    if (this.ready) return;
    this.ready = true;
    if (this.startup === 'buffer' && this.buffer.length > 0) {
      const queued = this.buffer.slice();
      this.buffer.length = 0;
      queued.forEach(v => void this.dispatch(v));
    }
  }

  on(handler: (p: Payload) => void | Promise<void>): () => void {
    this.handlers.add(handler);
    if (this.ready && this.startup === 'sticky' && this.stickyValue !== undefined) {
      void this.dispatch(this.stickyValue);
    }
    return () => this.off(handler);
  }

  off(handler: (p: Payload) => void | Promise<void>): void {
    this.handlers.delete(handler);
  }

  async emit(payload: Payload): Promise<void> {
    if (!this.ready) {
      if (this.startup === 'sticky') this.stickyValue = payload;
      if (this.startup === 'buffer') {
        if (this.bufferSize === 0 || this.buffer.length < this.bufferSize) {
          this.buffer.push(payload);
        }
      }
      return;
    }
    // Freeze plain object payloads to avoid mutation by handlers
    const safePayload = (isPlainObject(payload) ? Object.freeze(payload) : payload) as Payload;
    await this.dispatch(safePayload);
  }

  private async dispatch(payload: Payload): Promise<void> {
    const call = async (): Promise<void> => {
      for (const h of Array.from(this.handlers)) {
        try {
          await h(payload);
        } catch (err) {
          this.onHandlerError?.(err);
        }
      }
    };
    if (this.delivery === 'sync') return void (await call());
    if (this.delivery === 'microtask') return void Promise.resolve().then(() => void call());
    // async
    void Promise.resolve().then(call);
  }

  once(): Promise<Payload> {
    return new Promise<Payload>(resolve => {
      const off = this.on(v => {
        off();
        resolve(v);
      });
    });
  }
}

export function event(opts?: EventOptions): {
  __type: 'event-def';
  options?: EventOptions;
} {
  return { __type: 'event-def', options: opts };
}

export function createEvents(
  namespace: string,
  spec: Record<string, ReturnType<typeof event>>
): { namespace: string; spec: Record<string, ReturnType<typeof event>> } {
  return { namespace, spec };
}

export class EventBus {
  private ready = false;
  private readonly namespaces = new Map<string, Map<string, SimpleEvent<unknown>>>();
  private onHandlerError?: (ns: string, ev: string, err: unknown) => void;
  private readonly adapters: Array<{
    name: string;
    onStart?: (ctx: Record<string, unknown>) => void;
    onNamespace?: (ns: string) => void;
    onDefine?: (ns: string, ev: string, opts?: EventOptions) => void;
    onEmit?: (ns: string, ev: string, payload: unknown) => void;
  }> = [];
  private readonly globalMiddlewares: Array<
    (
      ctx: { namespace: string; eventName: string; payload: unknown },
      next: () => Promise<void>
    ) => Promise<void> | void
  > = [];
  private readonly namespaceMiddlewares = new Map<
    string,
    Array<
      (
        ctx: { namespace: string; eventName: string; payload: unknown },
        next: () => Promise<void>
      ) => Promise<void> | void
    >
  >();
  private readonly eventMiddlewares = new Map<
    string,
    Array<
      (
        ctx: { namespace: string; eventName: string; payload: unknown },
        next: () => Promise<void>
      ) => Promise<void> | void
    >
  >();
  private readonly counts = new Map<string, number>();

  start(): void {
    if (this.ready) return;
    this.ready = true;
    for (const a of this.adapters) a.onStart?.({});
    for (const ns of this.namespaces.values()) {
      for (const ev of ns.values()) ev.markReady();
    }
  }

  onError(handler: (namespace: string, eventName: string, err: unknown) => void): void {
    this.onHandlerError = handler;
  }

  use(
    mw: (
      ctx: { namespace: string; eventName: string; payload: unknown },
      next: () => Promise<void>
    ) => Promise<void> | void
  ): void {
    this.globalMiddlewares.push(mw);
  }

  useAdapter(adapter: {
    name: string;
    onStart?: (ctx: Record<string, unknown>) => void;
    onNamespace?: (ns: string) => void;
    onDefine?: (ns: string, ev: string, opts?: EventOptions) => void;
    onEmit?: (ns: string, ev: string, payload: unknown) => void;
  }): void {
    this.adapters.push(adapter);
  }

  namespace(name: string): {
    define: <P>(eventName: string, opts?: EventOptions) => Event<P>;
    get: <P>(eventName: string) => Event<P> | undefined;
    on: <P>(eventName: string, handler: (p: P) => void | Promise<void>) => () => void;
    emit: <P>(eventName: string, payload: P) => Promise<void>;
    use: (
      mw: (
        ctx: { namespace: string; eventName: string; payload: unknown },
        next: () => Promise<void>
      ) => Promise<void> | void
    ) => void;
  } {
    if (!this.namespaces.has(name)) this.namespaces.set(name, new Map());
    const map = this.namespaces.get(name)!;
    for (const a of this.adapters) a.onNamespace?.(name);
    return {
      define: <P>(eventName: string, opts?: EventOptions): Event<P> => {
        const existing = map.get(eventName) as unknown as SimpleEvent<unknown> | undefined;
        if (existing) {
          // Keep existing placeholder (may have buffered emissions) and just notify adapters
          for (const a of this.adapters) a.onDefine?.(name, eventName, opts);
          return existing as unknown as Event<P>;
        }
        const ev = new SimpleEvent<P>(opts, err => {
          const key = `events.errors.${name}.${eventName}`;
          this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
          this.onHandlerError?.(name, eventName, err);
        });
        if (this.ready) ev.markReady();
        map.set(eventName, ev as unknown as SimpleEvent<unknown>);
        for (const a of this.adapters) a.onDefine?.(name, eventName, opts);
        const base = ev as unknown as Event<P>;
        // attach pipe lazily (lightweight)
        base.pipe = <R>(): { on: (h: (v: R) => void) => () => void } => ({
          on: (h: (v: R) => void): (() => void) => base.on(h as unknown as (v: P) => void),
        });
        base.use = (
          mw: (
            ctx: { namespace: string; eventName: string; payload: unknown },
            next: () => Promise<void>
          ) => Promise<void> | void
        ): void => {
          const key = `${name}:${eventName}`;
          const arr = this.eventMiddlewares.get(key) ?? [];
          arr.push(mw);
          this.eventMiddlewares.set(key, arr);
        };
        // convenience wrappers: debounce/throttle middlewares per event
        (base as unknown as { debounce: (ms: number) => void }).debounce = (ms: number): void => {
          const key = `${name}:${eventName}`;
          const arr = this.eventMiddlewares.get(key) ?? [];
          const debounced = debounce(async () => undefined, ms);
          arr.push(async (_ctx, next) => {
            debounced();
            await next();
          });
          this.eventMiddlewares.set(key, arr);
        };
        (base as unknown as { throttle: (ms: number) => void }).throttle = (ms: number): void => {
          const key = `${name}:${eventName}`;
          const arr = this.eventMiddlewares.get(key) ?? [];
          const throttled = throttle(async () => undefined, ms);
          arr.push(async (_ctx, next) => {
            throttled();
            await next();
          });
          this.eventMiddlewares.set(key, arr);
        };
        return base;
      },
      get: <P>(eventName: string): Event<P> | undefined =>
        (map.get(eventName) as unknown as Event<P> | undefined) ?? undefined,
      on: <P>(eventName: string, handler: (p: P) => void | Promise<void>): (() => void) => {
        const ev =
          (map.get(eventName) as unknown as Event<P> | undefined) ??
          this.namespace(name).define<P>(eventName, { startup: 'buffer' });
        return ev.on(handler);
      },
      emit: async <P>(eventName: string, payload: P): Promise<void> => {
        const ev =
          (map.get(eventName) as unknown as Event<P> | undefined) ??
          this.namespace(name).define<P>(eventName, { startup: 'buffer' });
        for (const a of this.adapters) a.onEmit?.(name, eventName, payload as unknown);
        // run middlewares chain
        const key = `${name}:${eventName}`;
        const mws = [
          ...this.globalMiddlewares,
          ...(this.namespaceMiddlewares.get(name) ?? []),
          ...(this.eventMiddlewares.get(key) ?? []),
        ];
        let idx = -1;
        const next = async (): Promise<void> => {
          idx += 1;
          if (idx < mws.length) {
            await mws[idx]({ namespace: name, eventName, payload }, next);
          } else {
            await ev.emit(payload);
          }
        };
        await next();
      },
      use: (
        mw: (
          ctx: { namespace: string; eventName: string; payload: unknown },
          next: () => Promise<void>
        ) => Promise<void> | void
      ): void => {
        const arr = this.namespaceMiddlewares.get(name) ?? [];
        arr.push(mw);
        this.namespaceMiddlewares.set(name, arr);
      },
    };
  }
}
