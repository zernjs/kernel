/**
 * @file Public types for the Events layer.
 */

/** -------------------------
 * Domain types (stable codes)
 * ------------------------- */
export type DeliveryMode = 'sync' | 'microtask' | 'async';
export type StartupMode = 'drop' | 'buffer' | 'sticky';
export type EventNamespace = string;
export type EventName = string;
/** Fully-qualified event key composed by namespace and name. */
export type EventKey = string;

/** -------------------------
 * Public API types
 * ------------------------- */
export interface EventOptions {
  delivery?: DeliveryMode;
  startup?: StartupMode;
  /** Maximum buffered items when `startup === 'buffer'` (0 = unbounded). */
  bufferSize?: number;
}

export type EventHandler<Payload> = (p: Payload) => void | Promise<void>;

// Bivariant handler type to allow narrower parameter annotations in user callbacks
export type BivariantEventHandler<Payload> = {
  bivarianceHack: (p: Payload) => void | Promise<void>;
}['bivarianceHack'];

export interface Event<Payload> {
  on(handler: EventHandler<Payload>): () => void;
  off(handler: EventHandler<Payload>): void;
  emit(payload: Payload): Promise<void>;
  once(): Promise<Payload>;
  pipe?: <R>(
    ...ops: Array<
      (subscribe: (h: (v: Payload) => void) => () => void, next: (v: R) => void) => () => void
    >
  ) => { on: (h: (v: R) => void) => () => void };
  use?: (
    mw: (
      ctx: { namespace: string; eventName: string; payload: unknown },
      next: () => Promise<void>
    ) => Promise<void> | void
  ) => void;
}

export type Next = () => Promise<void> | void;

export interface EventContext {
  namespace: string;
  eventName: string;
  payload: unknown;
  options?: EventOptions;
}

export type Operator<I, O> = (
  source: (h: (v: I) => void) => () => void,
  next: (v: O) => void
) => () => void;

/**
 * Namespace API for event definition and interaction.
 */
import type { Middleware } from './middlewares';

export interface NamespaceApi {
  define: <P>(eventName: string, opts?: EventOptions) => Event<P>;
  get: <P>(eventName: string) => Event<P> | undefined;
  on: <P>(eventName: string, handler: EventHandler<P>) => () => void;
  emit: <P>(eventName: string, payload: P) => Promise<void>;
  use: (mw: Middleware) => void;
}

/** -------------------------
 * Internal structures
 * ------------------------- */
/** Set of handlers for a given payload type. */
export type EventHandlerSet<Payload> = Set<EventHandler<Payload>>;

export * from './adapters/types';

/**
 * Structural event definition type carried by createEvents/event for typing only.
 */
export type EventDef<Payload = unknown> = {
  __type: 'event-def';
  __payload?: Payload;
  options?: EventOptions;
};

export type NamespaceSpec<TSpec extends Record<string, EventDef>> = {
  namespace: string;
  spec: TSpec;
};

export type PayloadOf<E> = E extends { __payload?: infer P } ? P : unknown;

export type NamespaceApiTyped<TSpec extends Record<string, EventDef>> = {
  define: <K extends keyof TSpec & string>(
    name: K,
    opts?: EventOptions
  ) => Event<PayloadOf<TSpec[K]>>;
  get: <K extends keyof TSpec & string>(name: K) => Event<PayloadOf<TSpec[K]>> | undefined;
  on: <K extends keyof TSpec & string, HP = PayloadOf<TSpec[K]>>(
    name: K,
    handler: BivariantEventHandler<HP & PayloadOf<TSpec[K]>>
  ) => () => void;
  emit: <K extends keyof TSpec & string>(name: K, payload: PayloadOf<TSpec[K]>) => Promise<void>;
  use: (mw: Middleware) => void;
};

// ------- Global key typing helpers -------
type JoinNsEvent<TMap extends Record<string, Record<string, EventDef>>> = {
  [N in keyof TMap & string]: {
    [E in keyof TMap[N] & string]: `${N}.${E}`;
  }[keyof TMap[N] & string];
}[keyof TMap & string];

type NsOf<K extends string> = K extends `${infer N}.${string}` ? N : never;
type EvOf<K extends string> = K extends `${string}.${infer E}` ? E : never;

type PayloadOfKey<
  TMap extends Record<string, Record<string, EventDef>>,
  K extends string,
> = PayloadOf<TMap[NsOf<K> & keyof TMap][EvOf<K> & keyof TMap[NsOf<K> & keyof TMap]]>;

export type TypedEvents<TMap extends Record<string, Record<string, EventDef>>> = Omit<
  import('./event-bus').EventBus,
  'namespace' | 'on' | 'emit'
> & {
  namespace: <K extends keyof TMap & string>(namespaceName: K) => NamespaceApiTyped<TMap[K]>;
  /** Property-based access with full autocomplete of namespaces */
  ns: { [K in keyof TMap & string]: NamespaceApiTyped<TMap[K]> };
  /** Global flat API: keys like "namespace.event" */
  on: <K extends JoinNsEvent<TMap>>(
    key: K,
    handler: (payload: PayloadOfKey<TMap, Extract<K, string>>) => void | Promise<void>
  ) => () => void;
  emit: <K extends JoinNsEvent<TMap>>(
    key: K,
    payload: PayloadOfKey<TMap, Extract<K, string>>
  ) => Promise<void>;
};

// Application-level augmentation point for event maps used by useEvents() with no args.
// Projects can augment this interface via module augmentation to advertise their namespaces.
export interface ZernEvents {
  // brand to avoid empty-object-type rule and keep interface open for merging
  __zern_events_brand?: never;
}

// Use only explicitly-augmented keys for better autocomplete. Avoid a string index signature
// because it collapses keyof to `string` and kills suggestions.
export type GlobalEventMap = {
  [K in keyof ZernEvents & string]: ZernEvents[K] extends Record<string, EventDef>
    ? ZernEvents[K]
    : never;
};
