/**
 * @file Validation utilities
 * @description Provides validation functions for various scenarios in system
 */

export function isValidPluginName(name: string): boolean {
  const regex = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
  return regex.test(name) && name.length >= 2 && name.length <= 50;
}

export function isValidKernelId(id: string): boolean {
  const regex = /^[a-zA-Z0-9-]+$/;
  return regex.test(id) && id.length >= 5 && id.length <= 100;
}

export function validatePluginName(name: string): void {
  if (!isValidPluginName(name)) {
    throw new Error(
      `Invalid plugin name: ${name}. Must be 2-50 characteres, start with letter,
        contain only letters, numbers, hyphens, and underscores.`
    );
  }
}

export function validateKernelId(id: string): void {
  if (!isValidKernelId(id)) {
    throw new Error(
      `Invalid kernel ID: ${id}. Must be 5-100 characters, contain only letters, numbers, and hyphens.`
    );
  }
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}
