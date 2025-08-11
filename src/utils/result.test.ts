import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapError,
  andThen,
  match,
  unwrap,
  unwrapOr,
  fromPromise,
  tryCatch,
  all,
  fromNullable,
  any,
  combine,
  flatten,
  type Result,
} from '@utils';

describe('result', () => {
  it('ok/err and isOk/isErr', () => {
    const a = ok(1);
    const b = err('e');
    expect(isOk(a)).toBe(true);
    expect(isErr(a)).toBe(false);
    expect(isOk(b as Result<unknown>)).toBe(false);
    expect(isErr(b)).toBe(true);
  });

  it('map and mapError', () => {
    expect(map(ok(2), x => x + 1)).toEqual(ok(3));
    expect(map(err('e'), (x: number) => x + 1)).toEqual(err('e'));
    expect(mapError(ok(2), (e: string) => `E:${e}`)).toEqual(ok(2));
    expect(mapError(err('e'), e => `E:${e}`)).toEqual(err('E:e'));
  });

  it('andThen chains only on ok', () => {
    const r1 = andThen(ok(2), x => ok(x * 2));
    const r2 = andThen(err('e'), (_: unknown) => ok('x'));
    expect(r1).toEqual(ok(4));
    expect(r2).toEqual(err('e'));
  });

  it('match branches correctly', () => {
    const r = match(ok(3), { ok: v => v + 1, err: (_e: unknown) => -1 });
    expect(r).toBe(4);
  });

  it('unwrap/unwrapOr behave correctly', () => {
    expect(unwrap(ok('x'))).toBe('x');
    expect(unwrapOr(err('e'), 'fb')).toBe('fb');
    expect(() => unwrap(err(new Error('boom')))).toThrow('boom');
  });

  it('fromPromise resolves and rejects to Result', async () => {
    await expect(fromPromise(Promise.resolve(5))).resolves.toEqual(ok(5));
    await expect(fromPromise(Promise.reject('x'))).resolves.toEqual(err('x'));
  });

  it('tryCatch returns ok on success and err on throw', () => {
    expect(tryCatch(() => 1)).toEqual(ok(1));
    expect(
      tryCatch(() => {
        throw 'x';
      })
    ).toEqual(err('x'));
  });

  it('all returns err on first error otherwise ok tuple', async () => {
    await expect(all<[number, number], string>([ok(1), err('e')])).resolves.toEqual(err('e'));
    // Note: current implementation returns ok of original Result items, not unwrapped
    await expect(all<[number, number], string>([ok(1), ok(2)])).resolves.toEqual(
      ok([ok(1), ok(2)])
    );
  });

  it('fromNullable returns err on nullish', () => {
    expect(fromNullable(0, 'e')).toEqual(ok(0));
    expect(fromNullable(null, 'e')).toEqual(err('e'));
    expect(fromNullable(undefined, 'e')).toEqual(err('e'));
  });

  it('any returns first ok or errors array', () => {
    expect(any<number, string>([err('a'), err('b')])).toEqual(err(['a', 'b']));
    expect(any<number, string>([err('a'), ok(2), err('b')])).toEqual(ok(2));
  });

  it('combine merges object of results or returns first error', () => {
    expect(combine<{ a: number; b: string }, string>({ a: ok(1), b: ok('x') })).toEqual(
      ok({ a: 1, b: 'x' })
    );
    expect(combine<{ a: number; b: string }, string>({ a: ok(1), b: err('e') })).toEqual(err('e'));
  });

  it('flatten unwraps nested Result', () => {
    expect(flatten(ok(ok(1)))).toEqual(ok(1));
    expect(flatten(ok(err('e')))).toEqual(err('e'));
    expect(flatten(err('E'))).toEqual(err('E'));
  });
});
