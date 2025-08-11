/**
 * @file Unit tests for lifecycle policies (timeout/retry runner).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { runWithPolicy } from '@lifecycle/lifecycle-policies';
import * as utils from '@utils';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runWithPolicy', () => {
  it('returns action result without policy', async () => {
    const r = await runWithPolicy(async () => 42);
    expect(r).toBe(42);
  });

  it('applies timeout when timeoutMs > 0', async () => {
    const timeoutSpy = vi
      .spyOn(utils, 'timeout')
      .mockImplementation(
        async (p: Promise<unknown> | (() => Promise<unknown>), _ms: number) =>
          (typeof p === 'function' ? (p as () => Promise<unknown>)() : p) as Promise<unknown>
      );
    await runWithPolicy(async () => 1, { timeoutMs: 50 });
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('retries up to N times then succeeds', async () => {
    let attempts = 0;
    const r = await runWithPolicy(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('fail');
        return 'ok';
      },
      { retry: 5 }
    );
    expect(r).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('throws last error after exhausting retries', async () => {
    let attempts = 0;
    await expect(
      runWithPolicy(
        async () => {
          attempts += 1;
          throw new Error('boom');
        },
        { retry: 2 }
      )
    ).rejects.toThrow('boom');
    expect(attempts).toBe(3);
  });
});
