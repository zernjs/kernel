/**
 * @file Result helpers (Ok/Err) and small combinators.
 */

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };

export type Result<T, E = unknown> = Ok<T> | Err<E>;

type MatchHandlers<T, E, U> = { ok: (t: T) => U; err: (e: E) => U };

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok === true;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return r.ok === false;
}

export function map<T, E, U>(r: Result<T, E>, fn: (t: T) => U): Result<U, E> {
  return isOk(r) ? ok(fn(r.value)) : r;
}

export function mapError<T, E, F>(r: Result<T, E>, fn: (e: E) => F): Result<T, F> {
  return isErr(r) ? err(fn(r.error)) : r;
}

export function andThen<T, E, U>(r: Result<T, E>, fn: (t: T) => Result<U, E>): Result<U, E> {
  return isOk(r) ? fn(r.value) : r;
}

export function match<T, E, U>(r: Result<T, E>, handlers: MatchHandlers<T, E, U>): U {
  return isOk(r) ? handlers.ok(r.value) : handlers.err(r.error);
}

export function unwrap<T, E>(r: Result<T, E>): T {
  if (isOk(r)) return r.value;
  throw r.error as unknown;
}

export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return isOk(r) ? r.value : fallback;
}

export async function fromPromise<T>(p: Promise<T>): Promise<Result<T, unknown>> {
  try {
    const v = await p;
    return ok(v);
  } catch (e) {
    return err(e as unknown);
  }
}

export function tryCatch<T>(fn: () => T): Result<T, unknown> {
  try {
    return ok(fn());
  } catch (e) {
    return err(e as unknown);
  }
}

export async function all<T extends ReadonlyArray<unknown>, E = unknown>(results: {
  [K in keyof T]: Result<T[K], E>;
}): Promise<Result<{ [K in keyof T]: T[K] }, E>> {
  for (const r of results as Result<unknown, E>[]) if (isErr(r)) return err(r.error);
  return ok(results as unknown as { [K in keyof T]: T[K] });
}

export function fromNullable<T, E = unknown>(value: T | null | undefined, error: E): Result<T, E> {
  return value == null ? err(error) : ok(value as T);
}

export function any<T, E>(results: Result<T, E>[]): Result<T, E[]> {
  const errors: E[] = [];
  for (const r of results) {
    if (isOk(r)) return r;
    errors.push(r.error as E);
  }
  return err(errors);
}

export function combine<T extends Record<string, unknown>, E = unknown>(record: {
  [K in keyof T]: Result<T[K], E>;
}): Result<T, E> {
  const out = {} as T;
  for (const key of Object.keys(record) as Array<keyof T>) {
    const r = record[key];
    if (isErr(r)) return err(r.error);
    out[key] = (r as Ok<T[keyof T]>).value as T[keyof T];
  }
  return ok(out);
}

export function flatten<T, E>(r: Result<Result<T, E>, E>): Result<T, E> {
  return isOk(r) ? r.value : r;
}
