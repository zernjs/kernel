/**
 * @file Events operators and composition helpers.
 */
import type { Operator } from '@types';

type Handler<T> = (v: T) => void;
type Subscribe<T> = (h: Handler<T>) => () => void;
type Predicate<T> = (v: T) => boolean;
type Project<I, O> = (v: I) => O;

function composePipeline<T, R = T>(
  subscribe: Subscribe<T>,
  ops: Operator<unknown, unknown>[]
): Subscribe<R> {
  return ops.reduce(
    (composed, op) => (handler: Handler<R>) =>
      (op as Operator<unknown, R>)(composed as Subscribe<unknown>, handler),
    subscribe as unknown as Subscribe<R>
  );
}

export function filter<T>(predicate: Predicate<T>): Operator<T, T> {
  return (source, next) =>
    source(v => {
      if (predicate(v)) next(v);
    });
}

export function map<I, O>(project: Project<I, O>): Operator<I, O> {
  return (source, next) => source(v => next(project(v)));
}

export function pipe<T, R = T>(
  subscribe: Subscribe<T>,
  ...ops: Operator<unknown, unknown>[]
): (h: Handler<R>) => () => void {
  return composePipeline<T, R>(subscribe, ops);
}
