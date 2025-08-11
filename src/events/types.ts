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
