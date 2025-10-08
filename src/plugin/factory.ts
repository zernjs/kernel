/**
 * @file Plugin factory function
 * @description Factory function for creating new plugins
 */

import { createVersion } from '@/core';
import type { PluginBuilder } from './types';
import { PluginBuilderImpl } from './builder';

/**
 * Creates a new plugin with the specified name and version.
 *
 * @param name - Unique plugin identifier
 * @param version - Semantic version (e.g., "1.0.0")
 * @returns A plugin builder for configuring the plugin
 *
 * @example
 * ```typescript
 * const mathPlugin = plugin('math', '1.0.0')
 *   .setup(() => ({
 *     add: (a: number, b: number) => a + b
 *   }));
 * ```
 */
export function plugin<TName extends string>(
  name: TName,
  version: string
): PluginBuilder<
  TName,
  unknown,
  Record<string, never>,
  Record<string, never>,
  Record<string, unknown>,
  Record<string, never>
> {
  return new PluginBuilderImpl(name, createVersion(version));
}
