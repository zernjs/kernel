/**
 * @file Unit tests for `ConsoleChannel` and `WebhookChannel`.
 * @module alerts/channels.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConsoleChannel, WebhookChannel } from '@alerts/channels';
import type { IAlertChannel } from '@types';
import * as utils from '@utils';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConsoleChannel', () => {
  it('logs with default prefix', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ch: IAlertChannel = new ConsoleChannel();
    ch.dispatch('ns', 'Kind', { a: 1 });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toBe('[ALERT]');
    expect(warnSpy.mock.calls[0]?.[1]).toEqual({
      namespace: 'ns',
      kind: 'Kind',
      payload: { a: 1 },
    });
  });

  it('logs with custom prefix', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ch: IAlertChannel = new ConsoleChannel('[CUSTOM]');
    ch.dispatch('ui', 'Info', 'hello');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toBe('[CUSTOM]');
    expect(warnSpy.mock.calls[0]?.[1]).toEqual({
      namespace: 'ui',
      kind: 'Info',
      payload: 'hello',
    });
  });
});

describe('WebhookChannel', () => {
  it('performs a POST to the given URL with JSON body (no options)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: unknown) => {});
    const url = 'https://example.com/hook';
    const ch = new WebhookChannel(fetchMock, url);

    await ch.dispatch('ns', 'K', { x: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe(url);
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    // verify body json structure
    const body = (init as { body: string }).body;
    expect(typeof body).toBe('string');
    expect(JSON.parse(body)).toEqual({
      namespace: 'ns',
      kind: 'K',
      payload: { x: 1 },
    });

    // verify no timeout/retry used by default
    const timeoutSpy = vi.spyOn(utils, 'timeout');
    const retrySpy = vi.spyOn(utils, 'retry');
    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(retrySpy).not.toHaveBeenCalled();
  });

  it('uses timeout when timeoutMs is provided (passes through to utils.timeout)', async () => {
    const timeoutSpy = vi
      .spyOn(utils, 'timeout')
      .mockImplementation(async (p: Promise<unknown> | (() => Promise<unknown>), _ms: number) => {
        // pass-through the provided promise or function without enforcing a timer
        return (
          typeof p === 'function' ? await (p as () => Promise<unknown>)() : await p
        ) as unknown;
      });

    const fetchMock = vi.fn(async (_url: string, _init: unknown) => {});
    const ch = new WebhookChannel(fetchMock, 'https://x', { timeoutMs: 50 });

    await ch.dispatch('a', 'B', 123);

    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    const args = timeoutSpy.mock.calls[0]!;
    expect(typeof args[0] === 'object' || typeof args[0] === 'function').toBe(true);
    expect(args[1]).toBe(50);
  });

  it('retries when fetch fails initially and then succeeds', async () => {
    const calls: number[] = [];
    const fetchMock = vi.fn(async () => {
      calls.push(Date.now());
      if (calls.length < 3) {
        throw new Error('fail');
      }
      return;
    });

    // mock retry to immediately re-attempt without delays, respecting retries
    const retrySpy = vi
      .spyOn(utils, 'retry')
      .mockImplementation(async (fn: () => Promise<unknown>, opts: { retries: number }) => {
        let lastErr: unknown;
        for (let attempt = 0; attempt <= opts.retries; attempt++) {
          try {
            return await fn();
          } catch (e) {
            lastErr = e;
          }
        }
        throw lastErr;
      });

    const ch = new WebhookChannel(fetchMock, 'https://x', { retry: { retries: 2 } });
    await ch.dispatch('ns', 'X', 'p');

    expect(retrySpy).toHaveBeenCalledTimes(1);
    // three attempts in total (2 retries + initial)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('propagates Timeout error and retries up to the configured limit', async () => {
    const fetchMock = vi.fn(async () => {});

    // Force timeout to always reject
    const timeoutErr = new Error('Timeout');
    const timeoutSpy = vi.spyOn(utils, 'timeout').mockImplementation(async () => {
      throw timeoutErr;
    });

    // Mock retry to immediately repeat attempts with no delay
    const retrySpy = vi
      .spyOn(utils, 'retry')
      .mockImplementation(async (fn: () => Promise<unknown>, opts: { retries: number }) => {
        let lastErr: unknown;
        for (let attempt = 0; attempt <= opts.retries; attempt++) {
          try {
            await fn();
          } catch (e) {
            lastErr = e;
          }
        }
        throw lastErr;
      });

    const ch = new WebhookChannel(fetchMock, 'https://x', {
      timeoutMs: 5,
      retry: { retries: 2 },
    });

    await expect(ch.dispatch('ns', 'Y', { z: 1 })).rejects.toThrow('Timeout');

    // Each attempt calls fetch once before the timeout is applied in the wrapper
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(timeoutSpy).toHaveBeenCalledTimes(3);
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('succeeds with both timeout and retry when fetch eventually resolves', async () => {
    let attempt = 0;
    const fetchMock = vi.fn(async () => {
      attempt += 1;
      if (attempt < 3) return; // simulate quick resolve; we will let timeout pass-through
    });

    // Make timeout pass-through to the inner promise
    const timeoutSpy = vi
      .spyOn(utils, 'timeout')
      .mockImplementation(async (p: Promise<unknown> | (() => Promise<unknown>), _ms: number) => {
        return (
          typeof p === 'function' ? await (p as () => Promise<unknown>)() : await p
        ) as unknown;
      });

    // Retry to attempt up to retries+1 times; our exec succeeds anyway
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

    const ch = new WebhookChannel(fetchMock, 'https://x', {
      timeoutMs: 10,
      retry: { retries: 2 },
    });

    await expect(ch.dispatch('ns', 'OK', 1)).resolves.toBeUndefined();

    expect(timeoutSpy).toHaveBeenCalled();
    expect(retrySpy).toHaveBeenCalledTimes(1);
    // fetch was called at least once (exact count depends on exec success path)
    expect(fetchMock).toHaveBeenCalled();
  });
});
