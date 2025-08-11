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
 * Internal structures
 * ------------------------- */
export type HookSpecMap = Record<string, Hook<unknown>>;
export type HookMap = Map<HookName, Hook<unknown>>;

/** -------------------------
 * Error types
 * ------------------------- */
export type HookErrorHandler = (name: string, err: unknown) => void;
