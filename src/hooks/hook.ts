import type { Hook, Unsubscribe } from '@types';
import { isPlainObject } from '@utils';

export function hook<Payload>(onError?: (err: unknown) => void): Hook<Payload> {
  const handlers = new Set<(p: Payload) => void | Promise<void>>();
  const on = (h: (p: Payload) => void | Promise<void>): Unsubscribe => {
    handlers.add(h);
    return () => handlers.delete(h);
  };
  const off = (h: (p: Payload) => void | Promise<void>): void => {
    handlers.delete(h);
  };
  const emit = async (p: Payload): Promise<void> => {
    const safe = (isPlainObject(p) ? Object.freeze(p) : p) as Payload;
    for (const h of Array.from(handlers)) {
      try {
        await h(safe);
      } catch (err) {
        onError?.(err);
      }
    }
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
