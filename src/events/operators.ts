import type { Operator } from '@types';

export function filter<T>(predicate: (v: T) => boolean): Operator<T, T> {
  return (source, next) =>
    source(v => {
      if (predicate(v)) next(v);
    });
}

export function map<I, O>(project: (v: I) => O): Operator<I, O> {
  return (source, next) => source(v => next(project(v)));
}

export function pipe<T, R = T>(
  subscribe: (h: (v: T) => void) => () => void,
  ...ops: Operator<unknown, unknown>[]
): (h: (v: R) => void) => () => void {
  // Type-safe composition via unknown and casts at boundaries
  return ops.reduce(
    (acc, op) => (h: (v: R) => void) =>
      (op as Operator<unknown, R>)(acc as (h: (v: unknown) => void) => () => void, h),
    subscribe as unknown as (h: (v: R) => void) => () => void
  );
}
