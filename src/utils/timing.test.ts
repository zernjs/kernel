// src/utils/timing.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { delay, debounce, throttle, timeout, retry, type AbortSignalLike } from '@utils';

afterEach(() => {
  vi.useRealTimers();
});

describe('timing', () => {
  it('delay resolves after ms', async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const promise = delay(100).then(() => done());
    vi.advanceTimersByTime(99);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await promise;
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('debounce calls only once after wait', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const d = debounce(spy, 50);
    d();
    d();
    d();
    vi.advanceTimersByTime(49);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('throttle limits calls within interval', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const t = throttle(spy, 100);
    t(); // run
    t(); // ignore
    vi.advanceTimersByTime(100);
    t(); // run again
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('timeout resolves when inner resolves before deadline', async () => {
    vi.useFakeTimers();
    const p = timeout(delay(20), 50);
    vi.advanceTimersByTime(20);
    await expect(p).resolves.toBeUndefined();
  });

  it('timeout rejects with Timeout when exceeded', async () => {
    vi.useFakeTimers();
    const p = timeout(new Promise<never>(() => {}), 30);
    vi.advanceTimersByTime(30);
    await expect(p).rejects.toThrow('Timeout');
  });

  it('timeout rejects immediately when signal.aborted is true', async () => {
    const signal: AbortSignalLike = {
      aborted: true,
      addEventListener: (_t: 'abort', _cb: () => void) => {},
    };
    await expect(timeout(Promise.resolve(1), 10, signal)).rejects.toThrow('Timeout');
  });

  it('retry re-attempts and eventually succeeds', async () => {
    let attempts = 0;
    const r = await retry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('fail');
        return 'ok';
      },
      { retries: 5, baseMs: 1, jitter: 0 }
    );
    expect(r).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('retry throws after exceeding retries', async () => {
    let attempts = 0;
    await expect(
      retry(
        async () => {
          attempts += 1;
          throw new Error('fail');
        },
        { retries: 2, baseMs: 1, jitter: 0 }
      )
    ).rejects.toThrow('fail');
    expect(attempts).toBe(3);
  });
});
