import { describe, it, expect } from 'vitest';
import { Semaphore, withSemaphore, TaskQueue, parallelMap } from '@utils';

describe('concurrency', () => {
  it('Semaphore serializes when limit=1', async () => {
    const sem = new Semaphore(1);
    const order: string[] = [];
    const p1 = withSemaphore(sem, async () => {
      order.push('a:start');
      await Promise.resolve();
      order.push('a:end');
    });
    const p2 = withSemaphore(sem, async () => {
      order.push('b:start');
      await Promise.resolve();
      order.push('b:end');
    });
    await Promise.all([p1, p2]);
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('TaskQueue runs tasks in order and swallows errors', async () => {
    const q = new TaskQueue();
    const order: string[] = [];
    q.push(async () => {
      order.push('1');
    });
    q.push(async () => {
      order.push('2');
      throw new Error('boom');
    });
    q.push(async () => {
      order.push('3');
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(order).toEqual(['1', '2', '3']);
  });

  it('parallelMap respects concurrency limit and preserves result order', async () => {
    let running = 0;
    let maxRunning = 0;
    const items = [1, 2, 3, 4, 5, 6];
    const results = await parallelMap(items, 2, async x => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await Promise.resolve();
      running -= 1;
      return x * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10, 12]);
    expect(maxRunning).toBeLessThanOrEqual(2);
  });
});
