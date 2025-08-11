/**
 * @file Guard helpers for runtime type narrowing.
 */

type UnknownRecord = Record<string, unknown>;

export function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

export function isFunction<TArgs extends unknown[] = unknown[], TRet = unknown>(
  value: unknown
): value is (...args: TArgs) => TRet {
  return typeof value === 'function';
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function hasOwn<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): key is K & keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return isObject(value) && 'then' in value && isFunction((value as { then?: unknown }).then);
}

export function isPlainObject(value: unknown): value is UnknownRecord {
  if (!isObject(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function isIterable<T = unknown>(value: unknown): value is Iterable<T> {
  return isObject(value) && Symbol.iterator in value;
}

export function isAsyncIterable<T = unknown>(value: unknown): value is AsyncIterable<T> {
  return isObject(value) && Symbol.asyncIterator in value;
}
