/**
 * @file Public types for the Errors layer.
 */

export type ErrorNamespace = string;
export type ErrorKind = string;

/**
 * Common metadata propagated alongside reported errors.
 */
export interface ErrorMeta {
  source?: 'event' | 'hook' | 'lifecycle' | 'custom';
  namespace?: string;
  eventName?: string;
  plugin?: string;
  correlationId?: string;
  timestamp?: number;
  severity?: 'info' | 'warn' | 'error' | 'fatal';
  cause?: unknown;
}

export type ErrorPolicy = (err: unknown, meta?: ErrorMeta) => Promise<void> | void;

export type ErrorHandler<Payload> = (payload: Payload, meta?: ErrorMeta) => void | Promise<void>;

/**
 * Internal handler maps used by the error bus.
 */
export type ErrorHandlerSet = Set<ErrorHandler<unknown>>;
export type ErrorHandlersByKind = Map<ErrorKind, ErrorHandlerSet>;
export type ErrorHandlersByNamespace = Map<ErrorNamespace, ErrorHandlersByKind>;

/**
 * Stable kernel error codes.
 */
export type KernelErrorCode =
  | 'DependencyMissing'
  | 'DependencyVersionUnsatisfied'
  | 'DependencyCycle'
  | 'LifecyclePhaseFailed'
  | 'InvalidVersionSpec'
  | 'AugmentationConflict';

/**
 * Branded token produced by factories for safe routing.
 * @typeParam Payload - Payload carried by the token.
 */
export type ErrorToken<Payload> = Readonly<{
  __type: 'error-token';
  namespace: string;
  kind: string;
  payload: Payload;
}>;

/**
 * Factory function that creates a branded token for a specific error kind.
 * @typeParam Payload - Payload type accepted and carried by the token.
 * @typeParam K - Error kind literal type.
 */
export type ErrorFactory<Payload, K extends string = string> = ((
  payload: Payload
) => ErrorToken<Payload>) &
  Readonly<{
    __type: 'error-factory';
    __namespace: string;
    __kind: K;
  }>;

/**
 * Input spec mapping kinds to payload identity functions.
 */
export type ErrorSpecInput<T extends Record<string, unknown>> = {
  [K in keyof T]: (p: T[K]) => T[K];
};
/**
 * Factories generated from an input spec.
 */
export type ErrorFactories<T extends Record<string, unknown>> = {
  [K in keyof T]: ErrorFactory<T[K], Extract<K, string>>;
};
/**
 * Normalized spec metadata.
 * @typeParam T - Spec mapping kinds to payloads.
 * @typeParam N - Namespace literal type.
 */
export type ErrorSpec<T extends Record<string, unknown>, N extends string> = {
  namespace: N;
  kinds: ReadonlyArray<keyof T & string>;
};

/**
 * Normalized output of defineErrors(namespace, spec).
 */
export type DefinedErrors<T extends Record<string, unknown>, N extends string> = {
  spec: ErrorSpec<T, N>;
  factories: ErrorFactories<T>;
};

/**
 * Exception raised by `ErrorBus.fail(token)`.
 * @typeParam Payload - Payload carried by the token.
 */
export class ReportedError<Payload> extends Error {
  public readonly namespace: string;
  public readonly kind: string;
  public readonly payload: Payload;
  public readonly meta: ErrorMeta | undefined;

  /**
   * Construct a typed reported error.
   * @param namespace - Error namespace.
   * @param kind - Error kind.
   * @param payload - Payload carried by the token.
   * @param meta - Optional metadata.
   */
  constructor(namespace: string, kind: string, payload: Payload, meta?: ErrorMeta) {
    super(`${namespace}.${kind}`);
    this.name = 'ReportedError';
    this.namespace = namespace;
    this.kind = kind;
    this.payload = payload;
    this.meta = meta;
  }
}

/**
 * Typed marker used to build the global error map and helpers’ autocomplete.
 */
export type ErrorDef<Payload = unknown> = { __type: 'error-def'; __payload?: Payload };

/**
 * Extract payload from ErrorDef.
 */
export type ErrorPayloadOf<A> = A extends { __payload?: infer P } ? P : unknown;

/**
 * 'ns.kind' union from a namespace→kinds map.
 */
export type JoinNsKind<TMap extends Record<string, Record<string, ErrorDef>>> = {
  [N in keyof TMap & string]: {
    [K in keyof TMap[N] & string]: `${N}.${K}`;
  }[keyof TMap[N] & string];
}[keyof TMap & string];

/**
 * Helpers to split a 'ns.kind' key type-wise.
 */
export type NsOf<K extends string> = K extends `${infer N}.${string}` ? N : never;
export type KindOf<K extends string> = K extends `${string}.${infer E}` ? E : never;

/**
 * Infer payload type from a 'ns.kind' key and a global map.
 */
export type PayloadOfErrorKey<
  TMap extends Record<string, Record<string, ErrorDef>>,
  K extends string,
> = ErrorPayloadOf<
  TMap[NsOf<K> & keyof TMap & string][KindOf<K> &
    keyof TMap[NsOf<K> & keyof TMap & string] &
    string]
>;
