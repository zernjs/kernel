/**
 * @file Hook factory with safe payload emission and handler error reporting.
 */
import type { Hook, Unsubscribe, HookHandler } from '@types';
import { isPlainObject } from '@utils';

/**
 * Creates a Hook instance.
 * @typeParam Payload - The payload type for this hook.
 * @param onError - Optional error reporter invoked when a handler throws/rejects.
 * @returns A Hook with `on`, `off`, `emit`, and `once`.
 */
export function hook<Payload>(onError?: (err: unknown) => void): Hook<Payload> {
  const handlers = new Set<HookHandler<Payload>>();

  const removeHandler = (h: HookHandler<Payload>): void => {
    handlers.delete(h);
  };

  const addHandler = (h: HookHandler<Payload>): Unsubscribe => {
    handlers.add(h);
    return () => removeHandler(h);
  };

  const toSafePayload = (p: Payload): Payload =>
    (isPlainObject(p) ? Object.freeze(p) : p) as Payload;

  const callHandlers = async (p: Payload): Promise<void> => {
    for (const h of Array.from(handlers)) {
      try {
        await h(p);
      } catch (err) {
        onError?.(err);
      }
    }
  };

  const on = (h: HookHandler<Payload>): Unsubscribe => addHandler(h);

  const off = (h: HookHandler<Payload>): void => {
    removeHandler(h);
  };

  const emit = async (p: Payload): Promise<void> => {
    const safe = toSafePayload(p);
    await callHandlers(safe);
  };

  const once = (): Promise<Payload> =>
    new Promise<Payload>(resolve => {
      const unsub = on(v => {
        unsub();
        resolve(v);
      });
    });

  return { on, off, emit, once };
}
