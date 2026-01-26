/**
 * Agnostic utilities for Zern Kernel.
 * These utilities are environment-independent (work in Node.js, Browser, Deno, Bun).
 */

/**
 * Checks if a value is a simple non-null object.
 * Returns false for arrays and null.
 *
 * @param item - The value to check.
 * @returns True if the value is an object, false otherwise.
 */
export function isObject(item: unknown): item is Record<string, unknown> {
  return !!item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Performs a recursive deep merge of two objects.
 * The `target` object is modified in place.
 * Arrays are treated as values and are overwritten, not merged.
 *
 * @param target - The target object to receive properties.
 * @param source - The source object containing properties to merge.
 * @returns The modified target object.
 */
export function deepMerge(target: unknown, source: unknown): unknown {
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  return target;
}

/**
 * Generates a UUID v4 string.
 * It attempts to use the native `crypto.randomUUID()` if available.
 * Falls back to a Math.random() implementation for older environments.
 *
 * @returns A standard UUID v4 string (e.g., "123e4567-e89b-12d3-a456-426614174000").
 */
export function uuid(): string {
  // eslint-disable-next-line no-undef
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    // eslint-disable-next-line no-undef
    return (crypto as { randomUUID: () => string }).randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
