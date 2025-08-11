/**
 * @file Lightweight debug utilities.
 */

/**
 * Dump a labeled object to the console using `console.debug`.
 * @param name - Label/name for the object.
 * @param value - Value to print.
 * @returns void
 */
export function dumpObject(name: string, value: unknown): void {
  console.debug(`[debug] ${name}:`, value);
}
