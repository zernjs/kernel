/**
 * @file Unit tests for ErrorBus and helpers.
 */
import { describe, it, expect, vi } from 'vitest';
import { ErrorBus, createErrorFactory, defineErrors } from '@errors/error-bus';
import type { ErrorMeta } from '@types';
import { ReportedError } from '@types';

describe('ErrorBus basic routing', () => {
  it('subscribes handler and delivers payload/meta via Throw', async () => {
    const bus = new ErrorBus();
    const NotFound = createErrorFactory<{ id: string }, 'NotFound'>('repo', 'NotFound');

    const handler = vi.fn<(payload: { id: string }, meta?: ErrorMeta) => void>();
    bus.on(NotFound, handler);

    const token = NotFound({ id: '42' });
    const meta: ErrorMeta = { source: 'custom', namespace: 'repo' };
    await bus.Throw(token, meta);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ id: '42' }, meta);
  });

  it('unsubscribe stops delivery', async () => {
    const bus = new ErrorBus();
    const Invalid = createErrorFactory<string, 'Invalid'>('auth', 'Invalid');

    const handler = vi.fn<(payload: string, meta?: ErrorMeta) => void>();
    const off = bus.on(Invalid, handler);
    await bus.Throw(Invalid('a'));
    off();
    await bus.Throw(Invalid('b'));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith('a', undefined);
  });

  it('off is safe when handler is not registered and is idempotent', async () => {
    const bus = new ErrorBus();
    const E = createErrorFactory<number, 'E'>('ns', 'E');
    const handler = vi.fn<(payload: number, meta?: ErrorMeta) => void>();
    // not registered
    expect(() =>
      bus.off(E, handler as unknown as (p: unknown, m?: ErrorMeta) => void)
    ).not.toThrow();
    // register and then call off twice
    const off = bus.on(E, handler);
    off();
    off();
    await bus.Throw(E(1));
    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing when Throw has no subscribers', async () => {
    const bus = new ErrorBus();
    const E = createErrorFactory<void, 'E'>('ns', 'E');
    await expect(bus.Throw(E(undefined))).resolves.toBeUndefined();
  });

  it('awaits handlers sequentially, then Raise throws ReportedError', async () => {
    const bus = new ErrorBus();
    const Boom = createErrorFactory<number, 'Boom'>('svc', 'Boom');
    const order: string[] = [];

    const h1 = vi.fn(async (_p: number, _m?: ErrorMeta) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      order.push('h1');
    });
    const h2 = vi.fn((_p: number, _m?: ErrorMeta) => {
      order.push('h2');
    });

    bus.on(Boom, h1);
    bus.on(Boom, h2);

    await expect(bus.Raise(Boom(5), { source: 'custom' })).rejects.toBeInstanceOf(ReportedError);

    expect(order).toEqual(['h1', 'h2']);
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });
});

describe('createErrorFactory', () => {
  it('produces frozen tokens with correct shape and non-enumerable metadata on factory', () => {
    const Factory = createErrorFactory<{ x: number }, 'Kind'>('ns', 'Kind');
    const token = Factory({ x: 1 });

    // token shape and immutability
    expect(token.__type).toBe('error-token');
    expect(token.namespace).toBe('ns');
    expect(token.kind).toBe('Kind');
    expect(token.payload).toEqual({ x: 1 });
    expect(Object.isFrozen(token)).toBe(true);

    // factory metadata present but not enumerable
    expect(Factory.__type).toBe('error-factory');
    expect(Factory.__namespace).toBe('ns');
    expect(Factory.__kind).toBe('Kind');
    expect(Object.keys(Factory)).not.toContain('__namespace');
    expect(Object.keys(Factory)).not.toContain('__kind');
  });

  it('same handler added twice is invoked only once (Set semantics)', async () => {
    const bus = new ErrorBus();
    const F = createErrorFactory<number, 'E'>('ns', 'E');
    const handler = vi.fn((_p: number, _m?: ErrorMeta) => {});
    bus.on(F, handler);
    bus.on(F, handler);
    await bus.Throw(F(1));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('defineErrors', () => {
  it('defines factories and spec with namespace and kinds', async () => {
    const defined = defineErrors('auth', {
      InvalidCredentials: (p: { user: string }) => p,
      RateLimited: (p: { retryAfter: number }) => p,
    });

    expect(defined.spec.namespace).toBe('auth');
    expect(defined.spec.kinds).toEqual(['InvalidCredentials', 'RateLimited']);

    const { factories } = defined;
    const tokenA = factories.InvalidCredentials({ user: 'u1' });
    const tokenB = factories.RateLimited({ retryAfter: 10 });
    expect(tokenA.namespace).toBe('auth');
    expect(tokenA.kind).toBe('InvalidCredentials');
    expect(tokenB.kind).toBe('RateLimited');

    // Ensure integration with ErrorBus using on/Throw
    const bus = new ErrorBus();
    const hA = vi.fn<(p: { user: string }, m?: ErrorMeta) => void>();
    const hB = vi.fn<(p: { retryAfter: number }, m?: ErrorMeta) => void>();
    bus.on(factories.InvalidCredentials, hA);
    bus.on(factories.RateLimited, hB);

    await bus.Throw(tokenA, { source: 'custom', plugin: 'auth' });
    await bus.Throw(tokenB);

    expect(hA).toHaveBeenCalledWith({ user: 'u1' }, { source: 'custom', plugin: 'auth' });
    expect(hB).toHaveBeenCalledWith({ retryAfter: 10 }, undefined);
  });
});
