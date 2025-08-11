/**
 * @file Unit tests for Middleware typing and basic contract.
 * These tests validate that a typical middleware sequence behaves as expected.
 */
import { describe, it, expect } from 'vitest';
import type { EventContext } from '@types';
import type { Middleware } from '@events/middlewares';

function runChain(middlewares: Middleware[], ctx: EventContext): Promise<void> {
  let idx = -1;
  const next = async (): Promise<void> => {
    idx += 1;
    const mw = middlewares[idx];
    if (mw) await mw(ctx, next);
  };
  return next();
}

describe('middlewares', () => {
  it('execute in order and can read/modify context', async () => {
    const ctx: EventContext = { namespace: 'n', eventName: 'e', payload: 1 };
    const order: string[] = [];

    const mw1: Middleware = async (c, next) => {
      order.push('mw1-pre');
      c.payload = (c.payload as number) + 1;
      await next();
      order.push('mw1-post');
    };
    const mw2: Middleware = async (c, next) => {
      order.push('mw2-pre');
      c.payload = (c.payload as number) * 2;
      await next();
      order.push('mw2-post');
    };

    await runChain([mw1, mw2], ctx);
    expect(order).toEqual(['mw1-pre', 'mw2-pre', 'mw2-post', 'mw1-post']);
    expect(ctx.payload).toBe(4);
  });
});
