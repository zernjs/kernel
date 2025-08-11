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
  async Throw<Payload>(token: ErrorToken<Payload>, meta?: ErrorMeta): Promise<void> {
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
  async Raise<Payload>(token: ErrorToken<Payload>, meta?: ErrorMeta): Promise<never> {
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

  start(): void {
    if (this.isReady) return;
    this.isReady = true;
  }

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
  } {
    const define = <P, K extends string>(
      kind: K
    ): {
      on: (handler: ErrorHandler<P>) => () => void;
      throw: (payload: P, meta?: ErrorMeta) => Promise<void>;
      raise: (payload: P, meta?: ErrorMeta) => Promise<never>;
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
        throw: async (payload: P, meta?: ErrorMeta): Promise<void> =>
          this.Throw<P>(factory(payload), meta),
        raise: async (payload: P, meta?: ErrorMeta): Promise<never> =>
          this.Raise<P>(factory(payload), meta),
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
        throw: (p: P, m?: ErrorMeta) =>
          this.Throw<P>(createErrorFactory<P, string>(namespaceName, kind)(p), m),
        raise: (p: P, m?: ErrorMeta) =>
          this.Raise<P>(createErrorFactory<P, string>(namespaceName, kind)(p), m),
      }),
      on: <P>(kind: string, handler: ErrorHandler<P>): (() => void) =>
        this.on<P>(createErrorFactory<P, string>(namespaceName, kind), handler),
      throw: async <P>(kind: string, payload: P, meta?: ErrorMeta): Promise<void> =>
        this.Throw<P>(createErrorFactory<P, string>(namespaceName, kind)(payload), meta),
      raise: async <P>(kind: string, payload: P, meta?: ErrorMeta): Promise<never> =>
        this.Raise<P>(createErrorFactory<P, string>(namespaceName, kind)(payload), meta),
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
export function bindErrors<T extends Record<string, unknown>>(
  bus: ErrorBus,
  defined: DefinedErrors<T, string>
): {
  on: <K extends keyof T & string>(kind: K, handler: ErrorHandler<T[K]>) => () => void;
  throw: <K extends keyof T & string>(kind: K, payload: T[K], meta?: ErrorMeta) => Promise<void>;
  raise: <K extends keyof T & string>(kind: K, payload: T[K], meta?: ErrorMeta) => Promise<never>;
} {
  const { namespace } = defined.spec;
  const ns = bus.namespace(namespace);
  return {
    on: (kind, handler) => ns.on(kind as string, handler as ErrorHandler<unknown>),
    throw: async (kind, payload, meta) => ns.throw(kind as string, payload, meta),
    raise: async (kind, payload, meta) => ns.raise(kind as string, payload, meta),
  } as const;
}

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
