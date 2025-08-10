export type Unsubscribe = () => void;

export interface Hook<Payload> {
  on(handler: (p: Payload) => void | Promise<void>): Unsubscribe;
  off(handler: (p: Payload) => void | Promise<void>): void;
  emit(payload: Payload): Promise<void>;
  once(): Promise<Payload>;
}

export type HookSpecMap = Record<string, Hook<unknown>>;
