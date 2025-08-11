/**
 * @file Unit tests for hook() primitive.
 */
import { describe, it, expect, vi } from 'vitest';
import { hook } from '@hooks/hook';

describe('hook()', () => {
  it('subscribes, emits, and unsubscribes', async () => {
    const h = hook<number>();
    const spy = vi.fn((v: number): void => {
      expect(typeof v).toBe('number');
    });
    const off = h.on(spy);
    await h.emit(1);
    off();
    await h.emit(2);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(1);
  });

  it('does not duplicate same handler (Set semantics)', async () => {
    const h = hook<number>();
    const spy = vi.fn((_v: number): void => {});
    h.on(spy);
    h.on(spy);
    await h.emit(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('freezes plain object payloads (shallow) and not arrays/dates', async () => {
    const h1 = hook<{ a: number; nested: { x: number } }>();
    const h2 = hook<number[]>();
    const h3 = hook<Date>();

    const s1 = vi.fn((p: { a: number; nested: { x: number } }): void => {
      expect(Object.isFrozen(p)).toBe(true);
      expect(Object.isFrozen(p.nested)).toBe(false);
    });
    const s2 = vi.fn((p: number[]): void => {
      expect(Array.isArray(p)).toBe(true);
      expect(Object.isFrozen(p)).toBe(false);
    });
    const s3 = vi.fn((p: Date): void => {
      expect(p instanceof Date).toBe(true);
      expect(Object.isFrozen(p)).toBe(false);
    });

    h1.on(s1);
    h2.on(s2);
    h3.on(s3);
    await h1.emit({ a: 1, nested: { x: 1 } });
    await h2.emit([1, 2, 3]);
    await h3.emit(new Date());
    expect(s1).toHaveBeenCalledTimes(1);
    expect(s2).toHaveBeenCalledTimes(1);
    expect(s3).toHaveBeenCalledTimes(1);
  });

  it('awaits handlers sequentially and calls onError on failure', async () => {
    const onError = vi.fn((err: unknown): void => {
      expect(err).toBeInstanceOf(Error);
    });
    const h = hook<number>(onError);
    const order: string[] = [];
    const h1 = vi.fn(async (_v: number): Promise<void> => {
      await Promise.resolve();
      order.push('h1');
    });
    const h2 = vi.fn((_v: number): void => {
      order.push('h2');
      throw new Error('boom');
    });

    h.on(h1);
    h.on(h2);
    await h.emit(1);

    expect(order).toEqual(['h1', 'h2']);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('once resolves with the next value and unsubscribes itself', async () => {
    const h = hook<string>();
    const p = h.once();
    await h.emit('first');
    await expect(p).resolves.toBe('first');
    // emitting again should not affect the resolved promise
    const p2 = h.once();
    await h.emit('second');
    await expect(p2).resolves.toBe('second');
  });

  it('off is safe when handler not present and idempotent', async () => {
    const h = hook<number>();
    const s = vi.fn((_v: number): void => {});
    // not registered
    h.off(s);
    const off = h.on(s);
    off();
    off();
    await h.emit(1);
    expect(s).not.toHaveBeenCalled();
  });
});
