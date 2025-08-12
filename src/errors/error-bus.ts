/**
 * @file Error layer: strongly-typed error factories/tokens and central ErrorBus.
 */
import type {
  ErrorHandler,
  ErrorMeta,
  ErrorFactory,
  ErrorToken,
  ErrorHandlersByNamespace,
  ErrorSpecInput,
  ErrorFactories,
  DefinedErrors,
} from '@types';
import { ReportedError } from '@types';

/**
 * Central error bus for reporting and routing structured errors.
 */
export class ErrorBus {
  private readonly handlers: ErrorHandlersByNamespace = new Map();
  private readonly globalMiddlewares: Array<
    (
      ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
      next: () => Promise<void>
    ) => Promise<void> | void
  > = [];
  private readonly namespaceMiddlewares = new Map<string, typeof this.globalMiddlewares>();
  private readonly kindMiddlewares = new Map<string, typeof this.globalMiddlewares>();
  private isReady = false;

  public readonly ns: Record<
    string,
    {
      define: <P, K extends string>(
        kind: K
      ) => {
        on: (handler: ErrorHandler<P>) => () => void;
        throw: (payload: P, meta?: ErrorMeta) => Promise<void>;
        raise: (payload: P, meta?: ErrorMeta) => Promise<never>;
        use: (
          mw: (
            ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
            next: () => Promise<void>
          ) => Promise<void> | void
        ) => void;
      };
      get: <P>(kind: string) =>
        | {
            on: (h: ErrorHandler<P>) => () => void;
            throw: (p: P, m?: ErrorMeta) => Promise<void>;
            raise: (p: P, m?: ErrorMeta) => Promise<never>;
          }
        | undefined;
      on: <P>(kind: string, handler: ErrorHandler<P>) => () => void;
      throw: <P>(kind: string, payload: P, meta?: ErrorMeta) => Promise<void>;
      raise: <P>(kind: string, payload: P, meta?: ErrorMeta) => Promise<never>;
      use: (
        mw: (
          ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
          next: () => Promise<void>
        ) => Promise<void> | void
      ) => void;
    }
  > = new Proxy({}, { get: (_t, prop: string) => this.namespace(prop) });

  /**
   * Subscribe to a specific error factory (namespace+kind) with typed payload.
   * @typeParam Payload - Payload type produced by the factory.
   * @param factory - Error factory to subscribe to.
   * @param handler - Handler receiving the payload and optional metadata.
   * @returns Unsubscribe function.
   */
  on<Payload = unknown>(
    factory: ErrorFactory<Payload, string>,
    handler: ErrorHandler<Payload>
  ): () => void {
    const namespace = factory.__namespace;
    const kind = factory.__kind;
    if (!this.handlers.has(namespace)) this.handlers.set(namespace, new Map());
    const ns = this.handlers.get(namespace)!;
    if (!ns.has(kind)) ns.set(kind, new Set());
    const set = ns.get(kind)!;
    set.add(handler as ErrorHandler<unknown>);
    return () => this.off(factory, handler as ErrorHandler<unknown>);
  }

  /**
   * Unsubscribe a previously registered error handler for a given factory.
   * @typeParam Payload - Payload type produced by the factory.
   * @param factory - Error factory subscribed earlier.
   * @param handler - Handler to remove from the subscription set.
   * @returns void
   */
  off<Payload = unknown>(
    factory: ErrorFactory<Payload, string>,
    handler: ErrorHandler<unknown>
  ): void {
    const namespace = factory.__namespace;
    const kind = factory.__kind;
    const ns = this.handlers.get(namespace);
    if (!ns) return;
    const set = ns.get(kind);
    if (!set) return;
    set.delete(handler);
  }

  /**
   * Dispatch to all handlers for a given namespace/kind.
   * @internal
   */
  private async dispatchToHandlers<Payload = unknown>(
    namespace: string,
    kind: string,
    payload: Payload,
    meta?: ErrorMeta
  ): Promise<void> {
    const namespaceMap = this.handlers.get(namespace);
    const handlerSet = namespaceMap?.get(kind);
    if (!handlerSet || handlerSet.size === 0) return;
    for (const handler of Array.from(handlerSet) as ErrorHandler<Payload>[])
      await handler(payload, meta);
  }

  /**
   * Report an error token to subscribers. Does not throw.
   * @typeParam Payload - Token payload type.
   * @param token - Error token produced by a factory.
   * @param meta - Optional metadata (source, namespace, etc.).
   * @returns Promise resolved after all handlers run.
   */
  async report<Payload>(token: ErrorToken<Payload>, meta?: ErrorMeta): Promise<void> {
    const mws = this.collectMiddlewares(token.namespace, token.kind);
    await this.runMiddlewareChain(
      mws,
      { namespace: token.namespace, kind: token.kind, payload: token.payload, meta },
      async () => {
        await this.dispatchToHandlers<Payload>(token.namespace, token.kind, token.payload, meta);
      }
    );
  }

  /**
   * Report an error token and throw a typed exception to interrupt flow.
   * @typeParam Payload - Token payload type.
   * @param token - Error token produced by a factory.
   * @param meta - Optional metadata.
   * @returns Never; always throws `ReportedError`.
   */
  async fail<Payload>(token: ErrorToken<Payload>, meta?: ErrorMeta): Promise<never> {
    const mws = this.collectMiddlewares(token.namespace, token.kind);
    await this.runMiddlewareChain(
      mws,
      { namespace: token.namespace, kind: token.kind, payload: token.payload, meta },
      async () => {
        await this.dispatchToHandlers<Payload>(token.namespace, token.kind, token.payload, meta);
      }
    );
    throw new ReportedError<Payload>(token.namespace, token.kind, token.payload, meta);
  }

  start(): void {}

  use(
    mw: (
      ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
      next: () => Promise<void>
    ) => Promise<void> | void
  ): void {
    this.globalMiddlewares.push(mw);
  }

  namespace(namespaceName: string): {
    define: <P, K extends string>(
      kind: K
    ) => {
      on: (handler: ErrorHandler<P>) => () => void;
      report: (payload: P, meta?: ErrorMeta) => Promise<void>;
      fail: (payload: P, meta?: ErrorMeta) => Promise<never>;
      once: () => Promise<P>;
      use: (
        mw: (
          ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
          next: () => Promise<void>
        ) => Promise<void> | void
      ) => void;
    };
    get: <P>(kind: string) =>
      | {
          on: (h: ErrorHandler<P>) => () => void;
          report: (p: P, m?: ErrorMeta) => Promise<void>;
          fail: (p: P, m?: ErrorMeta) => Promise<never>;
          once: () => Promise<P>;
        }
      | undefined;
    on: <P>(kind: string, handler: ErrorHandler<P>) => () => void;
    report: <P>(kind: string, payload: P, meta?: ErrorMeta) => Promise<void>;
    fail: <P>(kind: string, payload: P, meta?: ErrorMeta) => Promise<never>;
    once: <P>(kind: string) => Promise<P>;
    use: (
      mw: (
        ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
        next: () => Promise<void>
      ) => Promise<void> | void
    ) => void;
  } {
    const define = <P, K extends string>(
      kind: K
    ): {
      on: (handler: ErrorHandler<P>) => () => void;
      report: (payload: P, meta?: ErrorMeta) => Promise<void>;
      fail: (payload: P, meta?: ErrorMeta) => Promise<never>;
      once: () => Promise<P>;
      use: (
        mw: (
          ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
          next: () => Promise<void>
        ) => Promise<void> | void
      ) => void;
    } => {
      const factory = createErrorFactory<P, K>(namespaceName, kind);
      return {
        on: (handler: ErrorHandler<P>): (() => void) => this.on<P>(factory, handler),
        report: async (payload: P, meta?: ErrorMeta): Promise<void> =>
          this.report<P>(factory(payload), meta),
        fail: async (payload: P, meta?: ErrorMeta): Promise<never> =>
          this.fail<P>(factory(payload), meta),
        once: (): Promise<P> =>
          new Promise<P>(resolve => {
            const off = this.on<P>(factory, (p): void => {
              off();
              resolve(p);
            });
          }),
        use: (
          mw: (
            ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
            next: () => Promise<void>
          ) => Promise<void> | void
        ): void => this.addKindMiddleware(namespaceName, String(kind), mw),
      } as const;
    };
    return {
      define,
      get: <P>(kind: string) => ({
        on: (h: ErrorHandler<P>) =>
          this.on<P>(createErrorFactory<P, string>(namespaceName, kind), h),
        report: (p: P, m?: ErrorMeta) =>
          this.report<P>(createErrorFactory<P, string>(namespaceName, kind)(p), m),
        fail: (p: P, m?: ErrorMeta) =>
          this.fail<P>(createErrorFactory<P, string>(namespaceName, kind)(p), m),
        once: (): Promise<P> =>
          new Promise<P>(resolve => {
            const factory = createErrorFactory<P, string>(namespaceName, kind);
            const off = this.on<P>(factory, (payload): void => {
              off();
              resolve(payload);
            });
          }),
      }),
      on: <P>(kind: string, handler: ErrorHandler<P>): (() => void) =>
        this.on<P>(createErrorFactory<P, string>(namespaceName, kind), handler),
      report: async <P>(kind: string, payload: P, meta?: ErrorMeta): Promise<void> =>
        this.report<P>(createErrorFactory<P, string>(namespaceName, kind)(payload), meta),
      fail: async <P>(kind: string, payload: P, meta?: ErrorMeta): Promise<never> =>
        this.fail<P>(createErrorFactory<P, string>(namespaceName, kind)(payload), meta),
      once: async <P>(kind: string): Promise<P> =>
        new Promise<P>(resolve => {
          const factory = createErrorFactory<P, string>(namespaceName, kind);
          const off = this.on<P>(factory, (payload): void => {
            off();
            resolve(payload);
          });
        }),
      use: (
        mw: (
          ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
          next: () => Promise<void>
        ) => Promise<void> | void
      ): void => this.addNamespaceMiddleware(namespaceName, mw),
    } as const;
  }

  private addNamespaceMiddleware(
    namespace: string,
    mw: (
      ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
      next: () => Promise<void>
    ) => Promise<void> | void
  ): void {
    const arr = this.namespaceMiddlewares.get(namespace) ?? [];
    arr.push(mw);
    this.namespaceMiddlewares.set(namespace, arr);
  }

  private addKindMiddleware(
    namespace: string,
    kind: string,
    mw: (
      ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
      next: () => Promise<void>
    ) => Promise<void> | void
  ): void {
    const key = `${namespace}:${kind}`;
    const arr = this.kindMiddlewares.get(key) ?? [];
    arr.push(mw);
    this.kindMiddlewares.set(key, arr);
  }

  private collectMiddlewares(
    namespace: string,
    kind: string
  ): Array<
    (
      ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
      next: () => Promise<void>
    ) => Promise<void> | void
  > {
    const key = `${namespace}:${kind}`;
    return [
      ...this.globalMiddlewares,
      ...(this.namespaceMiddlewares.get(namespace) ?? []),
      ...(this.kindMiddlewares.get(key) ?? []),
    ];
  }

  private async runMiddlewareChain(
    middlewares: Array<
      (
        ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
        next: () => Promise<void>
      ) => Promise<void> | void
    >,
    ctx: { namespace: string; kind: string; payload: unknown; meta?: ErrorMeta },
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
 * Bind helpers scoped to a defined errors descriptor (DX parity with events/alerts bindings).
 */

/**
 * Create an error factory for a specific namespace/kind pair.
 * @typeParam Payload - Payload type produced by the factory.
 * @typeParam K - Error kind literal type.
 * @param namespace - Error namespace (domain).
 * @param kind - Error kind within the namespace.
 * @returns ErrorFactory that builds typed tokens.
 */
export function createErrorFactory<Payload, K extends string>(
  namespace: string,
  kind: K
): ErrorFactory<Payload, K> {
  const fn = ((payload: Payload): ErrorToken<Payload> =>
    Object.freeze({ __type: 'error-token' as const, namespace, kind, payload })) as ErrorFactory<
    Payload,
    K
  >;
  Object.defineProperties(fn, {
    __type: { value: 'error-factory', enumerable: false },
    __namespace: { value: namespace, enumerable: false },
    __kind: { value: kind, enumerable: false },
  });
  return fn;
}

/**
 * Define a group of error kinds under a namespace and generate factories for them.
 * @typeParam N - Error namespace literal type.
 * @typeParam T - Shape mapping each kind to its payload type.
 * @param namespace - Error namespace (domain).
 * @param spec - Object whose keys are kinds and values are payload identity functions.
 * @returns Spec metadata and typed factories for each kind.
 */
export function defineErrors<const N extends string, T extends Record<string, unknown>>(
  namespace: N,
  spec: ErrorSpecInput<T>
): DefinedErrors<T, N> {
  const kindNames = Object.keys(spec) as Array<keyof T & string>;

  const factories = kindNames.reduce<ErrorFactories<T>>((factoriesByKind, kindName) => {
    type Payload = T[typeof kindName];
    (factoriesByKind as Record<string, unknown>)[kindName] = createErrorFactory<
      Payload,
      Extract<typeof kindName, string>
    >(namespace, kindName);
    return factoriesByKind;
  }, {} as ErrorFactories<T>);

  return { spec: { namespace, kinds: kindNames }, factories } as const;
}
