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
    await this.dispatchToHandlers<Payload>(token.namespace, token.kind, token.payload, meta);
  }

  /**
   * Report an error token and throw a typed exception to interrupt flow.
   * @typeParam Payload - Token payload type.
   * @param token - Error token produced by a factory.
   * @param meta - Optional metadata.
   * @returns Never; always throws `ReportedError`.
   */
  async Raise<Payload>(token: ErrorToken<Payload>, meta?: ErrorMeta): Promise<never> {
    await this.dispatchToHandlers<Payload>(token.namespace, token.kind, token.payload, meta);
    throw new ReportedError<Payload>(token.namespace, token.kind, token.payload, meta);
  }
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
