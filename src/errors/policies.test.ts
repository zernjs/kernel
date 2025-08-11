/**
 * @file Unit tests for built-in error policies.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { logPolicy, sentryPolicy, retryPolicy } from '@errors/policies';
import type { ErrorMeta } from '@types';
import * as utils from '@utils';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logPolicy', () => {
  it('logs sanitized plain object with meta', () => {
    const logger = { error: vi.fn((..._args: unknown[]): void => {}) };
    const policy = logPolicy(logger);
    const err = { a: 1, nested: { b: 2 }, fn: () => {} } as unknown as Record<string, unknown>;
    const meta: ErrorMeta = { source: 'custom', plugin: 'p1' };
    policy(err, meta);

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [label, payload] = (logger.error as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0] as unknown[];
    expect(label).toBe('KernelError');
    expect(payload).toEqual({ err: { a: 1, nested: { b: 2 } }, meta });
  });

  it('does not clone non-plain values', () => {
    const logger = { error: vi.fn((..._args: unknown[]): void => {}) };
    const policy = logPolicy(logger);
    const e = new Error('boom');
    policy(e);
    const payload = (logger.error as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]?.[1] as { err: unknown };
    expect(payload.err).toBe(e);
  });
});

describe('sentryPolicy', () => {
  it('captures sanitized error with meta context', () => {
    const sdk = {
      captureException: vi.fn((_e: unknown, _ctx?: Record<string, unknown>): void => {}),
    };
    const policy = sentryPolicy(sdk);
    const err = { a: 1, fn: () => {} } as unknown as Record<string, unknown>;
    const meta: ErrorMeta = { source: 'hook', namespace: 'n' };
    policy(err, meta);
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
    const [safe, ctx] = (sdk.captureException as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0] as [unknown, Record<string, unknown>];
    expect(safe).toEqual({ a: 1 });
    expect(ctx).toEqual({ meta });
  });
});

describe('retryPolicy', () => {
  it('retries handler and applies optional delay via timeout', async () => {
    const timeoutSpy = vi
      .spyOn(utils, 'timeout')
      .mockImplementation(
        async (_p: Promise<unknown> | (() => Promise<unknown>), _ms: number) =>
          undefined as unknown as never
      );
    const retrySpy = vi
      .spyOn(utils, 'retry')
      .mockImplementation(async (fn: () => Promise<unknown>, opts: { retries: number }) => {
        let lastErr: unknown;
        for (let i = 0; i <= opts.retries; i++) {
          try {
            return await fn();
          } catch (e) {
            lastErr = e;
          }
        }
        throw lastErr;
      });

    let calls = 0;
    const handler = vi.fn(async (_err: unknown, _meta?: ErrorMeta): Promise<void> => {
      calls += 1;
      if (calls < 2) throw new Error('fail');
    });

    const policy = retryPolicy(handler, {
      retries: 3,
      delayMs: 10,
      backoff: { baseMs: 1, jitter: 0 },
    });
    await expect(policy('x', { source: 'custom' })).resolves.toBeUndefined();

    expect(retrySpy).toHaveBeenCalledTimes(1);
    // one failure + one success = two attempts -> two delays
    expect(timeoutSpy).toHaveBeenCalledTimes(2);
    expect((timeoutSpy as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1]).toBe(10);
  });

  it('does not call timeout when delayMs is not provided', async () => {
    const timeoutSpy = vi.spyOn(utils, 'timeout').mockResolvedValue(undefined as unknown as never);
    const retrySpy = vi
      .spyOn(utils, 'retry')
      .mockImplementation(async (fn: () => Promise<unknown>, _opts: { retries: number }) => fn());

    const handler = vi.fn(async (_err: unknown, _meta?: ErrorMeta): Promise<void> => {});
    const policy = retryPolicy(handler, { retries: 0 });
    await policy('x');
    expect(retrySpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  it('propagates failure after exceeding retries', async () => {
    vi.spyOn(utils, 'timeout').mockResolvedValue(undefined as unknown as never);
    vi.spyOn(utils, 'retry').mockImplementation(
      async (fn: () => Promise<unknown>, opts: { retries: number }) => {
        let lastErr: unknown;
        for (let i = 0; i <= opts.retries; i++) {
          try {
            await fn();
          } catch (e) {
            lastErr = e;
          }
        }
        throw lastErr;
      }
    );

    const handler = vi.fn(async (_err: unknown, _meta?: ErrorMeta): Promise<void> => {
      throw new Error('boom');
    });
    const policy = retryPolicy(handler, { retries: 2, delayMs: 1 });
    await expect(policy('x')).rejects.toThrow('boom');
    expect(handler).toHaveBeenCalledTimes(3);
  });
});
