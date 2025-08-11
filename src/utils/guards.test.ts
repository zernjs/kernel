import { describe, it, expect } from 'vitest';
import {
  isObject,
  isFunction,
  isString,
  isNumber,
  hasOwn,
  assert,
  isPromise,
  isPlainObject,
  isIterable,
  isAsyncIterable,
} from '@utils';

describe('guards', () => {
  it('isObject', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
    expect(isObject(new Date())).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject(1)).toBe(false);
  });

  it('isFunction', () => {
    expect(isFunction(function f() {})).toBe(true);
    expect(isFunction(() => {})).toBe(true);
    class C {}
    expect(isFunction(C)).toBe(true);
    expect(isFunction({})).toBe(false);
  });

  it('isString', () => {
    expect(isString('x')).toBe(true);
    expect(isString(1)).toBe(false);
  });

  it('isNumber', () => {
    expect(isNumber(1)).toBe(true);
    expect(isNumber(NaN)).toBe(false);
    expect(isNumber(Infinity)).toBe(false);
  });

  it('hasOwn', () => {
    const obj = { a: 1 } as const;
    expect(hasOwn(obj, 'a')).toBe(true);
    expect(hasOwn(obj, 'b')).toBe(false);
  });

  it('assert', () => {
    expect(() => assert(true, 'err')).not.toThrow();
    expect(() => assert(false, 'err')).toThrow('err');
  });

  it('isPromise', () => {
    const p = Promise.resolve(1);
    expect(isPromise(p)).toBe(true);
    expect(isPromise({ then: () => {} })).toBe(true);
    expect(isPromise({})).toBe(false);
  });

  it('isPlainObject', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
  });

  it('isIterable / isAsyncIterable', () => {
    expect(isIterable([1, 2])).toBe(true);
    // primitive strings are not objects; function checks only objects with Symbol.iterator
    expect(isIterable('abc')).toBe(false);
    // object-wrapped string is an object and has Symbol.iterator on the prototype

    expect(isIterable(new String('abc'))).toBe(true);
    expect(isIterable({})).toBe(false);

    const asyncIt = { [Symbol.asyncIterator]: async function* _g() {} };
    expect(isAsyncIterable(asyncIt)).toBe(true);
    expect(isAsyncIterable({})).toBe(false);
  });
});
