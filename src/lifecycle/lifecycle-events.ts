/**
 * @file Lifecycle event emitter with safe payload and per-event handlers.
 */
import type { Handler, LifecycleEventMap, LifecycleHandlersMap } from '@types';
import { isPlainObject } from '@utils';

export class LifecycleEvents {
  private handlers: LifecycleHandlersMap = {};

  on<K extends keyof LifecycleEventMap>(evt: K, h: Handler<LifecycleEventMap[K]>): () => void {
    const list = this.getHandlers(evt);
    const next = [...list, h];
    this.setHandlers(evt, next);
    return () => this.removeHandler(evt, h);
  }

  async emit<K extends keyof LifecycleEventMap>(
    evt: K,
    payload: LifecycleEventMap[K]
  ): Promise<void> {
    const arr = this.getHandlers(evt);
    const safe = this.toSafePayload(payload);
    for (const h of arr) await h(safe);
  }

  private getHandlers<K extends keyof LifecycleEventMap>(evt: K): Handler<LifecycleEventMap[K]>[] {
    return (this.handlers[evt] as Handler<LifecycleEventMap[K]>[] | undefined) ?? [];
  }

  private setHandlers<K extends keyof LifecycleEventMap>(
    evt: K,
    arr: Handler<LifecycleEventMap[K]>[]
  ): void {
    (this.handlers as Record<string, unknown>)[evt as string] = arr as unknown;
  }

  private removeHandler<K extends keyof LifecycleEventMap>(
    evt: K,
    h: Handler<LifecycleEventMap[K]>
  ): void {
    const arr = this.getHandlers(evt);
    const idx = arr.indexOf(h as Handler<LifecycleEventMap[K]>);
    if (idx >= 0) arr.splice(idx, 1);
    this.setHandlers(evt, arr);
  }

  private toSafePayload<T>(p: T): T {
    return (isPlainObject(p) ? Object.freeze(p) : p) as T;
  }
}
