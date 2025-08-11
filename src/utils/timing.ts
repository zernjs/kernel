/**
 * @file Timing helpers: delay, debounce, throttle, timeout, retry.
 */

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void fn(...args);
      timer = null;
    }, waitMs);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  intervalMs: number
): (...args: Parameters<T>) => void {
  let last = 0;
  return (...args: Parameters<T>): void => {
    const now = Date.now();
    if (now - last >= intervalMs) {
      last = now;
      void fn(...args);
    }
  };
}

export interface AbortSignalLike {
  aborted: boolean;
  addEventListener: (type: 'abort', cb: () => void, opts?: { once?: boolean }) => void;
}

function toPromise<T>(promiseOrFn: Promise<T> | (() => Promise<T>)): Promise<T> {
  return typeof promiseOrFn === 'function' ? (promiseOrFn as () => Promise<T>)() : promiseOrFn;
}

export async function timeout<T>(
  promiseOrFn: Promise<T> | (() => Promise<T>),
  ms: number,
  signal?: AbortSignalLike
): Promise<T> {
  const work = toPromise(promiseOrFn);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const abortErr = new Error('Timeout');

  const timeoutP = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(abortErr), ms);
  });

  try {
    if (signal) {
      if (signal.aborted) throw abortErr;
      const race = new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(abortErr), { once: true });
      });
      return (await Promise.race([work, timeoutP, race])) as T;
    }
    return (await Promise.race([work, timeoutP])) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: { retries: number; baseMs?: number; jitter?: number }
): Promise<T> {
  const base = opts.baseMs ?? 100;
  const jitter = opts.jitter ?? 0.1;
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (e) {
      attempt += 1;
      if (attempt > opts.retries) throw e;
      const backoff = Math.round(base * 2 ** (attempt - 1));
      const sway = 1 + (Math.random() * 2 - 1) * jitter;
      await delay(Math.max(0, Math.floor(backoff * sway)));
    }
  }
}
