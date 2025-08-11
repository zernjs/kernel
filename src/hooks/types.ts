/**
 * @file Public types for the Hooks layer.
 */

/** -------------------------
 * Domain types (stable codes)
 * ------------------------- */
export type HookName = string;

/** -------------------------
 * Public API types
 * ------------------------- */
export type Unsubscribe = () => void;

export type HookHandler<Payload> = (p: Payload) => void | Promise<void>;

export interface Hook<Payload> {
  on(handler: HookHandler<Payload>): Unsubscribe;
  off(handler: HookHandler<Payload>): void;
  emit(payload: Payload): Promise<void>;
  once(): Promise<Payload>;
}

/** -------------------------
 * Declarative spec & namespace API (DX parity with events)
 * ------------------------- */

/** Structural hook definition type carried by createHooks/defineHook for typing only. */
export type HookDef<Payload = unknown> = {
  __type: 'hook-def';
  __payload?: Payload;
  options?: { delivery?: 'sync' | 'microtask' | 'async' };
};

/** Utility to extract payload from a HookDef. */
export type PayloadOf<E> = E extends { __payload?: infer P } ? P : unknown;

/** Typed namespace API produced from a spec map. */
export type HookNamespaceApiTyped<TSpec extends Record<string, HookDef>> = {
  define: <K extends keyof TSpec & string>(name: K) => Hook<PayloadOf<TSpec[K]>>;
  get: <K extends keyof TSpec & string>(name: K) => Hook<PayloadOf<TSpec[K]>> | undefined;
  on: <K extends keyof TSpec & string, HP = PayloadOf<TSpec[K]>>(
    name: K,
    handler: HookHandler<HP & PayloadOf<TSpec[K]>>
  ) => () => void;
  emit: <K extends keyof TSpec & string>(name: K, payload: PayloadOf<TSpec[K]>) => Promise<void>;
};

/** Application-level augmentation point for hook maps used by useHooks() with no args. */
export interface ZernHooks {
  __zern_hooks_brand?: never;
}

export type GlobalHookMap = {
  [K in keyof ZernHooks & string]: ZernHooks[K] extends Record<string, HookDef>
    ? ZernHooks[K]
    : never;
};

/** -------------------------
 * Internal structures
 * ------------------------- */
export type HookSpecMap = Record<string, Hook<unknown>>;
export type HookMap = Map<HookName, Hook<unknown>>;

/** -------------------------
 * Error types
 * ------------------------- */
export type HookErrorHandler = (name: string, err: unknown) => void;
