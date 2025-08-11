/**
 * @file Event bus with delivery/startup policies, middlewares and adapters.
 */
import type {
  Event,
  EventOptions,
  DeliveryMode,
  StartupMode,
  EventAdapter,
  EventContext,
  EventNamespace,
  EventName,
  EventKey,
  EventHandler,
  NamespaceApi,
} from '@types';
import type { Middleware } from '@events/middlewares';
import { isPlainObject, debounce, throttle } from '@utils';

class SimpleEvent<Payload> implements Event<Payload> {
  private handlerSet: Set<EventHandler<Payload>> = new Set();
  private readonly delivery: DeliveryMode;
  private readonly startup: StartupMode;
  private readonly bufferSize: number;
  private isReady = false;
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
    if (this.isReady) return;
    this.isReady = true;
    if (this.startup === 'buffer' && this.buffer.length > 0) {
      const queued = this.buffer.slice();
      this.buffer.length = 0;
      queued.forEach(v => void this.dispatch(v));
    }
  }

  on(handler: EventHandler<Payload>): () => void {
    this.handlerSet.add(handler);
    if (this.isReady && this.startup === 'sticky' && this.stickyValue !== undefined) {
      void this.dispatch(this.stickyValue);
    }
    return () => this.off(handler);
  }

  off(handler: EventHandler<Payload>): void {
    this.handlerSet.delete(handler);
  }

  async emit(payload: Payload): Promise<void> {
    if (!this.isReady) {
      this.handlePreReady(payload);
      return;
    }
    const safePayload = this.toSafePayload(payload);
    await this.dispatch(safePayload);
  }

  private handlePreReady(payload: Payload): void {
    if (this.startup === 'sticky') this.stickyValue = payload;
    if (this.startup === 'buffer') {
      if (this.bufferSize === 0 || this.buffer.length < this.bufferSize) {
        this.buffer.push(payload);
      }
    }
  }

  private toSafePayload(payload: Payload): Payload {
    return (isPlainObject(payload) ? Object.freeze(payload) : payload) as Payload;
  }

  private async callHandlers(payload: Payload): Promise<void> {
    for (const h of Array.from(this.handlerSet)) {
      try {
        await h(payload);
      } catch (err) {
        this.onHandlerError?.(err);
      }
    }
  }

  private async dispatch(payload: Payload): Promise<void> {
    const call = async (): Promise<void> => {
      await this.callHandlers(payload);
    };
    if (this.delivery === 'sync') return void (await call());
    if (this.delivery === 'microtask') return void Promise.resolve().then(() => void call());
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

/**
 * Factory helper to declare an event spec.
 * @param opts Options for event delivery/startup/buffer behavior.
 * @returns Event spec token.
 */
export function event<Payload = unknown>(
  opts?: EventOptions
): {
  __type: 'event-def';
  /** Phantom payload type carrier for typing helpers */
  __payload?: Payload;
  options?: EventOptions;
} {
  return { __type: 'event-def', options: opts } as const;
}

/**
 * Groups a set of event specs under a namespace.
 * @param namespace Namespace name.
 * @param spec Event spec map.
 * @returns Namespaced spec descriptor.
 */
export function createEvents<TSpec extends Record<string, ReturnType<typeof event<unknown>>>>(
  namespace: string,
  spec: TSpec
): { namespace: string; spec: TSpec } {
  return { namespace, spec } as const;
}

type ExtractPayload<T> = T extends { __payload?: infer P } ? P : unknown;

/**
 * Bind typed helpers using a descriptor returned by createEvents(namespace, spec).
 */
export function bindEvents<TSpec extends Record<string, ReturnType<typeof event<unknown>>>>(
  bus: EventBus,
  descriptor: { namespace: string; spec: TSpec }
): {
  emit: <K extends keyof TSpec & string>(
    event: K,
    payload: ExtractPayload<TSpec[K]>
  ) => Promise<void>;
  on: <K extends keyof TSpec & string>(
    event: K,
    handler: (payload: ExtractPayload<TSpec[K]>) => void | Promise<void>
  ) => () => void;
} {
  const { namespace, spec } = descriptor;
  void spec; // type-only
  return {
    emit: async (event, payload): Promise<void> => {
      await bus.namespace(namespace).emit(event as string, payload as unknown);
    },
    on: (event, handler): (() => void) =>
      bus.namespace(namespace).on(event as string, handler as (p: unknown) => void),
  } as const;
}

export class EventBus {
  private isReady = false;
  private readonly namespaces = new Map<string, Map<string, SimpleEvent<unknown>>>();
  private onHandlerError?: (namespace: string, eventName: string, err: unknown) => void;
  private readonly adapters: EventAdapter[] = [];
  private readonly globalMiddlewares: Middleware[] = [];
  private readonly namespaceMiddlewares = new Map<string, Middleware[]>();
  private readonly eventMiddlewares = new Map<string, Middleware[]>();
  private readonly counts = new Map<string, number>();

  /**
   * Typed access bag: populated lazily by Kernel through declaration.
   * At runtime it's a simple index into namespace() to avoid coupling types to runtime.
   */
  public readonly ns: Record<string, NamespaceApi> = new Proxy(
    {},
    {
      get: (_t, prop: string): NamespaceApi => this.namespace(prop),
    }
  );

  /**
   * Flat API: "namespace.event" helpers. Runtime is untyped; compile-time typing is added by TypedEvents.
   */
  on(key: string, handler: (payload: unknown) => void | Promise<void>): () => void {
    const [ns, ev] = this.splitKey(key);
    return this.namespace(ns).on(ev, handler as (p: unknown) => void);
  }

  async emit(key: string, payload: unknown): Promise<void> {
    const [ns, ev] = this.splitKey(key);
    await this.namespace(ns).emit(ev, payload);
  }

  private splitKey(key: string): [string, string] {
    const idx = key.indexOf('.');
    if (idx <= 0 || idx === key.length - 1) return [key, ''];
    return [key.slice(0, idx), key.slice(idx + 1)];
  }

  /**
   * Starts the bus and marks all existing events as ready.
   */
  start(): void {
    if (this.isReady) return;
    this.isReady = true;
    for (const a of this.adapters) a.onStart?.({});
    this.markAllEventsReady();
  }

  /**
   * Registers a handler to be notified when an event handler throws/rejects.
   * @param handler Error callback.
   */
  onError(handler: (namespace: string, eventName: string, err: unknown) => void): void {
    this.onHandlerError = handler;
  }

  /**
   * Registers a global middleware applied to all events.
   * @param middleware Middleware function.
   */
  use(middleware: Middleware): void {
    this.globalMiddlewares.push(middleware);
  }

  /**
   * Registers an adapter to observe bus activity.
   * @param adapter Adapter instance.
   */
  useAdapter(adapter: EventAdapter): void {
    this.adapters.push(adapter);
  }

  /**
   * Gets a namespaced API for defining and emitting events.
   * @param namespaceName Namespace name.
   */
  namespace(namespaceName: EventNamespace): NamespaceApi {
    const eventsByName = this.getOrCreateNamespaceMap(namespaceName);
    for (const a of this.adapters) a.onNamespace?.(namespaceName);

    return {
      define: <P>(eventName: EventName, opts?: EventOptions): Event<P> => {
        const existing = eventsByName.get(eventName) as unknown as SimpleEvent<unknown> | undefined;
        if (existing) {
          for (const a of this.adapters) a.onDefine?.(namespaceName, eventName, opts);
          return existing as unknown as Event<P>;
        }

        const ev = new SimpleEvent<P>(opts, err => {
          const key = `events.errors.${namespaceName}.${eventName}`;
          this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
          this.onHandlerError?.(namespaceName, eventName, err);
        });

        if (this.isReady) ev.markReady();
        eventsByName.set(eventName, ev as unknown as SimpleEvent<unknown>);
        for (const a of this.adapters) a.onDefine?.(namespaceName, eventName, opts);

        const base = ev as unknown as Event<P>;
        this.attachEventUtilities(base, namespaceName, eventName);
        return base;
      },

      get: <P>(eventName: EventName): Event<P> | undefined =>
        (eventsByName.get(eventName) as unknown as Event<P> | undefined) ?? undefined,

      on: <P>(eventName: EventName, handler: EventHandler<P>): (() => void) => {
        const ev =
          (eventsByName.get(eventName) as unknown as Event<P> | undefined) ??
          this.namespace(namespaceName).define<P>(eventName, { startup: 'buffer' });
        return ev.on(handler);
      },

      emit: async <P>(eventName: EventName, payload: P): Promise<void> => {
        const ev =
          (eventsByName.get(eventName) as unknown as Event<P> | undefined) ??
          this.namespace(namespaceName).define<P>(eventName, { startup: 'buffer' });

        for (const a of this.adapters) a.onEmit?.(namespaceName, eventName, payload as unknown);

        const mws = this.collectMiddlewares(namespaceName, eventName);
        const ctx = { namespace: namespaceName, eventName, payload } as EventContext;

        await this.runMiddlewareChain(mws, ctx, async () => {
          await ev.emit(payload);
        });
      },

      use: (middleware: Middleware): void => {
        const arr = this.namespaceMiddlewares.get(namespaceName) ?? [];
        arr.push(middleware);
        this.namespaceMiddlewares.set(namespaceName, arr);
      },
    };
  }

  private markAllEventsReady(): void {
    for (const ns of this.namespaces.values()) {
      for (const ev of ns.values()) ev.markReady();
    }
  }

  private getOrCreateNamespaceMap(
    namespaceName: EventNamespace
  ): Map<string, SimpleEvent<unknown>> {
    if (!this.namespaces.has(namespaceName)) this.namespaces.set(namespaceName, new Map());
    return this.namespaces.get(namespaceName)!;
  }

  private makeEventKey(namespaceName: EventNamespace, eventName: EventName): EventKey {
    return `${namespaceName}:${eventName}`;
  }

  private addEventMiddleware(key: EventKey, middleware: Middleware): void {
    const arr = this.eventMiddlewares.get(key) ?? [];
    arr.push(middleware);
    this.eventMiddlewares.set(key, arr);
  }

  private collectMiddlewares(namespaceName: EventNamespace, eventName: EventName): Middleware[] {
    const key = this.makeEventKey(namespaceName, eventName);
    return [
      ...this.globalMiddlewares,
      ...(this.namespaceMiddlewares.get(namespaceName) ?? []),
      ...(this.eventMiddlewares.get(key) ?? []),
    ];
  }

  private async runMiddlewareChain(
    middlewares: Middleware[],
    ctx: EventContext,
    final: () => Promise<void>
  ): Promise<void> {
    let idx = -1;
    const next = async (): Promise<void> => {
      idx += 1;
      if (idx < middlewares.length) {
        await middlewares[idx](ctx, next);
      } else {
        await final();
      }
    };
    await next();
  }

  private attachEventUtilities(
    base: Event<unknown>,
    namespaceName: EventNamespace,
    eventName: EventName
  ): void {
    // pipe shim (identity, delegates to .on)
    base.pipe = <R>(): { on: (h: (v: R) => void) => () => void } => ({
      on: (h: (v: R) => void): (() => void) => base.on(h as unknown as (v: unknown) => void),
    });

    // event-level middleware
    base.use = (middleware: Middleware): void => {
      const key = this.makeEventKey(namespaceName, eventName);
      this.addEventMiddleware(key, middleware);
    };

    // debounce helper
    (base as unknown as { debounce: (ms: number) => void }).debounce = (ms: number): void => {
      const key = this.makeEventKey(namespaceName, eventName);
      const debounced = debounce(async () => undefined, ms);
      this.addEventMiddleware(key, async (_ctx, next) => {
        debounced();
        await next();
      });
    };

    // throttle helper
    (base as unknown as { throttle: (ms: number) => void }).throttle = (ms: number): void => {
      const key = this.makeEventKey(namespaceName, eventName);
      const throttled = throttle(async () => undefined, ms);
      this.addEventMiddleware(key, async (_ctx, next) => {
        throttled();
        await next();
      });
    };
  }
}
