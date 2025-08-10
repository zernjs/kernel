import type { Handler, LifecycleEventMap } from '@types';
import { isPlainObject } from '@utils';

export class LifecycleEvents {
  private handlers: Partial<{ [K in keyof LifecycleEventMap]: Handler<LifecycleEventMap[K]>[] }> =
    {};

  on<K extends keyof LifecycleEventMap>(evt: K, h: Handler<LifecycleEventMap[K]>): () => void {
    const current = (this.handlers[evt] as Handler<LifecycleEventMap[K]>[] | undefined) ?? [];
    const next = [...current, h];
    (this.handlers as Record<string, unknown>)[evt as string] = next as unknown;
    return () => {
      const arr = (this.handlers[evt] as Handler<LifecycleEventMap[K]>[] | undefined) ?? [];
      const idx = arr.indexOf(h as Handler<LifecycleEventMap[K]>);
      if (idx >= 0) arr.splice(idx, 1);
      (this.handlers as Record<string, unknown>)[evt as string] = arr as unknown;
    };
  }

  async emit<K extends keyof LifecycleEventMap>(
    evt: K,
    payload: LifecycleEventMap[K]
  ): Promise<void> {
    const arr = (this.handlers[evt] as Handler<LifecycleEventMap[K]>[] | undefined) ?? [];
    const safe = (
      isPlainObject(payload) ? Object.freeze(payload) : payload
    ) as LifecycleEventMap[K];
    for (const h of arr) await h(safe);
  }
}
