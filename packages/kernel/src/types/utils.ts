/**
 * @fileoverview Utility types for the Zern Kernel
 * @module @zern/kernel/types/utils
 */

/**
 * Branded type for nominal typing
 */
export type Branded<T, Brand> = T & { readonly __brand: Brand };

/**
 * Make all properties in T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make all properties in T readonly recursively
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Array with at least one element
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Prettify intersection types for better IDE display
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Convert union to intersection
 */
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/**
 * Pick properties by their type
 */
export type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

/**
 * Omit properties by their type
 */
export type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

/**
 * Require at least one property from T
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * Require exactly one property from T
 */
export type RequireExactlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>>;
  }[Keys];

/**
 * Make readonly properties mutable
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Make required properties optional
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make properties nullable
 */
export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

/**
 * Strict non-nullable (excludes null and undefined)
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Function type utilities
 */
export type AnyFunction = (...args: unknown[]) => unknown;
export type AsyncFunction<T extends AnyFunction> = (
  ...args: Parameters<T>
) => Promise<ReturnType<T>>;

/**
 * Promise utilities
 */
export type Awaitable<T> = T | Promise<T>;
export type PromiseValue<T> = T extends Promise<infer U> ? U : T;

/**
 * Object utilities
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type ValuesOfType<T, U> = T[KeysOfType<T, U>];

/**
 * String utilities
 */
export type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

export type Join<T extends readonly string[], D extends string> = T extends readonly [
  infer F,
  ...infer R,
]
  ? F extends string
    ? R extends readonly string[]
      ? R['length'] extends 0
        ? F
        : `${F}${D}${Join<R, D>}`
      : never
    : never
  : '';

export type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}`
  ? [T, ...Split<U, D>]
  : [S];

/**
 * Tuple utilities
 */
export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]]
  ? H
  : never;

export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : [];

export type Last<T extends readonly unknown[]> = T extends readonly [...unknown[], infer L]
  ? L
  : never;

export type Length<T extends readonly unknown[]> = T['length'];

/**
 * Conditional utilities
 */
export type If<C extends boolean, T, F> = C extends true ? T : F;

export type Not<C extends boolean> = C extends true ? false : true;

export type And<A extends boolean, B extends boolean> = A extends true
  ? B extends true
    ? true
    : false
  : false;

export type Or<A extends boolean, B extends boolean> = A extends true
  ? true
  : B extends true
    ? true
    : false;

/**
 * Type assertion utilities
 */
export type Assert<T, U> = T extends U ? T : never;

export type IsEqual<T, U> = T extends U ? (U extends T ? true : false) : false;

export type IsNever<T> = [T] extends [never] ? true : false;

export type IsAny<T> = 0 extends 1 & T ? true : false;

export type IsUnknown<T> = IsAny<T> extends true ? false : unknown extends T ? true : false;

/**
 * Path utilities for nested objects
 */
export type PathKeys<T> = T extends object
  ? {
      [K in keyof T]: K extends string | number
        ? T[K] extends object
          ? K | `${K}.${PathKeys<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

export type PathValue<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer R}`
    ? K extends keyof T
      ? PathValue<T[K], R>
      : never
    : never;

/**
 * Error handling utilities
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

export type Try<T> = Result<T, Error>;

/**
 * Event utilities
 */
export type EventMap = Record<string, unknown>;

export type EventKey<T extends EventMap> = string & keyof T;

export type EventReceiver<T extends EventMap> = (params: T[EventKey<T>]) => void;

/**
 * Configuration utilities
 */
export type ConfigValue = string | number | boolean | null | undefined;

export type ConfigObject = {
  [key: string]: ConfigValue | ConfigObject | ConfigValue[] | ConfigObject[];
};

/**
 * Validation utilities
 */
export type Validator<T> = (value: unknown) => value is T;

export type ValidationError = {
  path: string;
  message: string;
  value: unknown;
};

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: ValidationError[] };

/**
 * Plugin utilities
 */
export type PluginId = Branded<string, 'PluginId'>;
export type PluginVersion = Branded<string, 'PluginVersion'>;
export type EventId = Branded<string, 'EventId'>;
export type StatePathString = Branded<string, 'StatePath'>;
export type NodeVersion = Branded<string, 'NodeVersion'>;

/**
 * Factory functions for branded types
 */
export function createPluginId(id: string): PluginId {
  return id as PluginId;
}

export function createPluginVersion(version: string): PluginVersion {
  return version as PluginVersion;
}

export function createEventId(id: string): EventId {
  return id as EventId;
}

export function createStatePath(path: string): StatePathString {
  return path as StatePathString;
}

export function createNodeVersion(version: string): NodeVersion {
  return version as NodeVersion;
}

/**
 * Type guards
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

export function isPromise<T>(value: unknown): value is Promise<T> {
  return value instanceof Promise;
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
