/**
 * @file Unit tests for event operators: filter, map, pipe.
 */
import { describe, it, expect } from 'vitest';
import { filter, map, pipe } from '@events/operators';
import type { Operator as Op } from '@types';

type Handler<T> = (v: T) => void;

function createSource<T>(): {
  subscribe: (h: Handler<T>) => () => void;
  next: (v: T) => void;
} {
  let handlers: Handler<T>[] = [];
  return {
    subscribe: (h: Handler<T>): (() => void) => {
      handlers.push(h);
      return (): void => {
        handlers = handlers.filter(x => x !== h);
      };
    },
    next: (v: T): void => {
      handlers.forEach(h => h(v));
    },
  };
}

describe('operators: filter', () => {
  it('passes values matching predicate and blocks others', () => {
    const src = createSource<number>();
    const values: number[] = [];
    const subscribe = pipe<number, number>(
      src.subscribe,
      filter((n: number) => n % 2 === 0) as unknown as Op<unknown, unknown>
    );
    const unsub = subscribe((v: number): void => {
      values.push(v);
    });
    src.next(1);
    src.next(2);
    src.next(3);
    src.next(4);
    expect(values).toEqual([2, 4]);
    unsub();
  });
});

describe('operators: map', () => {
  it('projects values using mapping function', () => {
    const src = createSource<number>();
    const values: string[] = [];
    const subscribe = pipe<number, string>(
      src.subscribe,
      map((n: number) => `#${n}`) as unknown as Op<unknown, unknown>
    );
    const unsub = subscribe((v: string): void => {
      values.push(v);
    });
    src.next(1);
    src.next(2);
    expect(values).toEqual(['#1', '#2']);
    unsub();
  });
});

describe('operators: pipe composition and unsubscribe', () => {
  it('composes multiple operators and supports unsubscribe propagation', () => {
    const src = createSource<number>();
    const values: number[] = [];
    const subscribe = pipe<number, number>(
      src.subscribe,
      filter((n: number) => n > 1) as unknown as Op<unknown, unknown>,
      map((n: number) => n * 10) as unknown as Op<unknown, unknown>
    );
    const unsub = subscribe((v: number): void => {
      values.push(v);
    });
    src.next(1);
    src.next(2);
    src.next(3);
    expect(values).toEqual([20, 30]);
    unsub();
    src.next(4);
    expect(values).toEqual([20, 30]);
  });
});
