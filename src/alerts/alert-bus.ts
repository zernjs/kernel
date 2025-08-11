/**
 * @file Alerts layer core: in-process publish/subscribe bus and helpers for declarative alert specs.
 * Exposes `AlertBus`, `defineAlert`, `createAlerts`, and `bindAlerts`.
 */
import type { AlertHandler, AlertHandlersByNamespace, IAlertBus, IAlertChannel } from './types';
import type { Middleware } from '@events/middlewares';
import type { EventContext } from '@events/types';
import { isPlainObject } from '@utils';

/**
 * Lightweight alert bus for broadcasting notifications to in-process subscribers
 * and out-of-process channels (e.g., console, webhooks).
 */
export class AlertBus implements IAlertBus {
  private readonly handlers: AlertHandlersByNamespace = new Map();
  private readonly channels: IAlertChannel[] = [];
  private readonly globalMiddlewares: Middleware[] = [];
  private readonly namespaceMiddlewares = new Map<string, Middleware[]>();
  private readonly kindMiddlewares = new Map<string, Middleware[]>();
  private isReady = false;

  public readonly ns: Record<
    string,
    {
      define: <P>(kind: string) => {
        on: (h: AlertHandler<P>) => () => void;
        emit: (p: P) => Promise<void>;
        use: (mw: Middleware) => void;
      };
      get: <P>(
        kind: string
      ) => { on: (h: AlertHandler<P>) => () => void; emit: (p: P) => Promise<void> } | undefined;
      on: <P>(kind: string, handler: AlertHandler<P>) => () => void;
      emit: <P>(kind: string, payload: P) => Promise<void>;
      use: (mw: Middleware) => void;
    }
  > = new Proxy(
    {},
    {
      get: (_t, prop: string) => this.namespace(prop),
    }
  );

  /**
   * Subscribe a handler to a namespaced alert kind.
   * Supports both flat key ("ns.kind") and tuple (ns, kind) forms.
   */
  on<Payload = unknown>(key: string, handler: AlertHandler<Payload>): () => void;
  on<Payload = unknown>(
    namespace: string,
    kind: string,
    handler: AlertHandler<Payload>
  ): () => void;
  on<Payload = unknown>(
    a: string,
    b: string | AlertHandler<Payload>,
    c?: AlertHandler<Payload>
  ): () => void {
    if (typeof b === 'string') {
      const namespace = a;
      const kind = b;
      const handler = c as AlertHandler<Payload>;
      const set = this.getOrCreateHandlerSet(namespace, kind);
      set.add(handler as AlertHandler<unknown>);
      return () => this.off(namespace, kind, handler as AlertHandler<unknown>);
    }
    const [ns, kind] = this.splitKey(a);
    const handler = b as AlertHandler<Payload>;
    const set = this.getOrCreateHandlerSet(ns, kind);
    set.add(handler as AlertHandler<unknown>);
    return () => this.off(ns, kind, handler as AlertHandler<unknown>);
  }

  /**
   * Unsubscribe a previously registered handler.
   * @param namespace - Alerts namespace.
   * @param kind - Alert kind.
   * @param handler - Handler instance to remove.
   * @returns void
   */
  off(namespace: string, kind: string, handler: AlertHandler<unknown>): void {
    const set = this.handlers.get(namespace)?.get(kind);
    if (!set) return;
    set.delete(handler);
  }

  /**
   * Emit an alert to subscribers and channels.
   * If the payload is a plain object, the bus freezes it to prevent accidental mutation.
   * @typeParam Payload - Emitted payload type.
   * @param namespace - Alerts namespace.
   * @param kind - Alert kind.
   * @param payload - Payload to deliver to handlers.
   * @returns Promise that resolves when all handlers and channels have been invoked.
   */
  /**
   * Emit an alert to subscribers and channels.
   * Supports both flat key ("ns.kind") and tuple (ns, kind) forms.
   */
  emit<Payload = unknown>(key: string, payload: Payload): Promise<void>;
  emit<Payload = unknown>(namespace: string, kind: string, payload: Payload): Promise<void>;
  async emit<Payload = unknown>(a: string, b: string | Payload, c?: Payload): Promise<void> {
    if (typeof b === 'string') {
      const namespace = a;
      const kind = b;
      const payload = c as Payload;
      const safePayload = this.ensureSafePayload(payload);
      const mws = this.collectMiddlewares(namespace, kind);
      const ctx = { namespace, eventName: kind, payload: safePayload } as EventContext;
      await this.runMiddlewareChain(mws, ctx, async () => {
        const set = this.handlers.get(namespace)?.get(kind) as
          | Set<AlertHandler<Payload>>
          | undefined;
        if (set && set.size > 0) {
          for (const h of Array.from(set)) await h(safePayload);
        }
        for (const ch of this.channels) await ch.dispatch(namespace, kind, safePayload);
      });
      return;
    }
    const [namespace, kind] = this.splitKey(a);
    const payload = b as Payload;
    const safePayload = this.ensureSafePayload(payload);
    const mws = this.collectMiddlewares(namespace, kind);
    const ctx = { namespace, eventName: kind, payload: safePayload } as EventContext;
    await this.runMiddlewareChain(mws, ctx, async () => {
      const set = this.handlers.get(namespace)?.get(kind) as Set<AlertHandler<Payload>> | undefined;
      if (set && set.size > 0) {
        for (const h of Array.from(set)) await h(safePayload);
      }
      for (const ch of this.channels) await ch.dispatch(namespace, kind, safePayload);
    });
  }

  /**
   * Register an outbound channel that receives every emitted alert.
   * @param channel - Channel sink that will receive all alerts.
   * @returns void
   */
  useChannel(channel: IAlertChannel): void {
    this.channels.push(channel);
  }

  start(): void {
    if (this.isReady) return;
    this.isReady = true;
  }

  use(middleware: Middleware): void {
    this.globalMiddlewares.push(middleware);
  }

  namespace(namespaceName: string): {
    define: <P>(kind: string) => {
      on: (h: AlertHandler<P>) => () => void;
      emit: (p: P) => Promise<void>;
      use: (mw: Middleware) => void;
    };
    get: <P>(
      kind: string
    ) => { on: (h: AlertHandler<P>) => () => void; emit: (p: P) => Promise<void> } | undefined;
    on: <P>(kind: string, handler: AlertHandler<P>) => () => void;
    emit: <P>(kind: string, payload: P) => Promise<void>;
    use: (mw: Middleware) => void;
  } {
    const define = <P>(
      kind: string
    ): {
      on: (h: AlertHandler<P>) => () => void;
      emit: (p: P) => Promise<void>;
      use: (mw: Middleware) => void;
    } => {
      void this.getOrCreateHandlerSet(namespaceName, kind);
      const api = {
        on: (h: AlertHandler<P>): (() => void) => this.on<P>(namespaceName, kind, h),
        emit: async (p: P): Promise<void> => this.emit<P>(namespaceName, kind, p),
        use: (mw: Middleware): void => this.addKindMiddleware(namespaceName, kind, mw),
      } as const;
      return api;
    };
    return {
      define,
      get: <P>(kind: string) =>
        this.handlers.get(namespaceName)?.get(kind) ? define<P>(kind) : undefined,
      on: <P>(kind: string, handler: AlertHandler<P>): (() => void) =>
        this.on<P>(namespaceName, kind, handler),
      emit: async <P>(kind: string, payload: P): Promise<void> =>
        this.emit<P>(namespaceName, kind, payload),
      use: (mw: Middleware): void => this.addNamespaceMiddleware(namespaceName, mw),
    } as const;
  }

  private getOrCreateHandlerSet(namespace: string, kind: string): Set<AlertHandler<unknown>> {
    if (!this.handlers.has(namespace)) this.handlers.set(namespace, new Map());
    const ns = this.handlers.get(namespace)!;
    if (!ns.has(kind)) ns.set(kind, new Set());
    return ns.get(kind)!;
  }

  private ensureSafePayload<P>(payload: P): P {
    return isPlainObject(payload) ? (Object.freeze(payload) as P) : payload;
  }

  private splitKey(key: string): [string, string] {
    const idx = key.indexOf('.');
    if (idx <= 0 || idx === key.length - 1) return [key, ''];
    return [key.slice(0, idx), key.slice(idx + 1)];
  }

  private addNamespaceMiddleware(namespace: string, middleware: Middleware): void {
    const arr = this.namespaceMiddlewares.get(namespace) ?? [];
    arr.push(middleware);
    this.namespaceMiddlewares.set(namespace, arr);
  }

  private addKindMiddleware(namespace: string, kind: string, middleware: Middleware): void {
    const key = `${namespace}:${kind}`;
    const arr = this.kindMiddlewares.get(key) ?? [];
    arr.push(middleware);
    this.kindMiddlewares.set(key, arr);
  }

  private collectMiddlewares(namespace: string, kind: string): Middleware[] {
    const key = `${namespace}:${kind}`;
    return [
      ...this.globalMiddlewares,
      ...(this.namespaceMiddlewares.get(namespace) ?? []),
      ...(this.kindMiddlewares.get(key) ?? []),
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
      if (idx < middlewares.length) await middlewares[idx](ctx, next);
      else await final();
    };
    await next();
  }
}

/**
 * Declarative alert kind marker for plugin specifications.
 * @returns An opaque marker consumed by {@link createAlerts}.
 */
export function defineAlert<Payload = unknown>(): { __type: 'alert-def'; __payload?: Payload } {
  return { __type: 'alert-def' } as const;
}

/**
 * Build an alerts specification object consumable by `definePlugin`.
 * @param namespace - Alerts namespace (unique per plugin/domain).
 * @param spec - Object map of alert kinds created with {@link defineAlert}.
 * @returns `{ namespace, kinds }` with readonly kinds for compile-time safety.
 */
export function createAlerts(
  namespace: string,
  spec: Record<string, ReturnType<typeof defineAlert>>
): {
  namespace: string;
  spec: Record<string, { __type: 'alert-def' }>;
  kinds: ReadonlyArray<keyof typeof spec & string>;
} {
  return {
    namespace,
    spec,
    kinds: Object.keys(spec) as Array<keyof typeof spec & string>,
  } as const;
}

/**
 * Bind convenience `on`/`emit` helpers scoped to a namespace/kinds.
 * @param bus - Source alert bus.
 * @param namespace - Alerts namespace to bind.
 * @param _spec - Spec used for typing the allowed kinds (value is ignored at runtime).
 * @returns Bound `emit`/`on` helpers restricted to declared kinds.
 */
type BoundAlerts<TSpec extends Record<string, ReturnType<typeof defineAlert<unknown>>>> = {
  emit: <K extends keyof TSpec & string, P = unknown>(kind: K, payload: P) => Promise<void>;
  on: <K extends keyof TSpec & string, P = unknown>(
    kind: K,
    handler: AlertHandler<P>
  ) => () => void;
};

/* eslint-disable no-redeclare */
export function bindAlerts<TSpec extends Record<string, ReturnType<typeof defineAlert<unknown>>>>(
  bus: AlertBus,
  descriptor: { namespace: string; spec: TSpec }
): BoundAlerts<TSpec>;
export function bindAlerts<TSpec extends Record<string, ReturnType<typeof defineAlert<unknown>>>>(
  bus: AlertBus,
  namespace: string,
  spec: TSpec
): BoundAlerts<TSpec>;
export function bindAlerts<TSpec extends Record<string, ReturnType<typeof defineAlert<unknown>>>>(
  bus: AlertBus,
  arg1: { namespace: string; spec: TSpec } | string,
  arg2?: TSpec
): BoundAlerts<TSpec> {
  const namespace: string = typeof arg1 === 'string' ? arg1 : arg1.namespace;
  const _spec: TSpec | undefined = typeof arg1 === 'string' ? arg2 : arg1.spec;
  void _spec; // type-only
  return {
    emit: async <K extends keyof TSpec & string, P = unknown>(
      kind: K,
      payload: P
    ): Promise<void> => {
      await bus.emit(namespace, kind as string, payload);
    },
    on: <K extends keyof TSpec & string, P = unknown>(
      kind: K,
      handler: AlertHandler<P>
    ): (() => void) => bus.on(namespace, kind as string, handler as AlertHandler<unknown>),
  } as const as BoundAlerts<TSpec>;
}
/* eslint-enable no-redeclare */
