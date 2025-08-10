export type DeliveryMode = 'sync' | 'microtask' | 'async';
export type StartupMode = 'drop' | 'buffer' | 'sticky';

export interface EventOptions {
  delivery?: DeliveryMode;
  startup?: StartupMode;
  bufferSize?: number; // used when startup === 'buffer'
}

export interface Event<Payload> {
  on(handler: (p: Payload) => void | Promise<void>): () => void;
  off(handler: (p: Payload) => void | Promise<void>): void;
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

export * from './adapters/types';
