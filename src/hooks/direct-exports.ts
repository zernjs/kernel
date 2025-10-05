/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Direct exports system for plugin methods
 * @description Allows plugins to export methods directly as named exports with full type safety
 */

import { getGlobalKernel } from './direct-methods';

/**
 * Creates direct method exports with automatic type inference
 *
 * This allows plugin authors to export methods that can be imported directly,
 * just like a normal library, while still resolving through the kernel at runtime.
 *
 * @example
 * ```typescript
 * // In your plugin file
 * export const scientificPlugin = plugin('scientific', '1.0.0')
 *   .extend(mathPlugin, () => ({
 *     log: (x: number) => Math.log(x),
 *     exp: (x: number) => Math.exp(x),
 *   }))
 *   .setup(() => ({
 *     calculatePi: () => Math.PI,
 *   }));
 *
 * // Export direct methods (signatures for type inference)
 * export const { log, exp, calculatePi } = createDirectExports('scientific', {
 *   log: (x: number): number => 0,
 *   exp: (x: number): number => 0,
 *   calculatePi: (): number => 0,
 * });
 *
 * // Usage in other files
 * import { log, exp } from 'scientific-plugin';
 * log(Math.E);  // ✅ Autocomplete works!
 * ```
 *
 * @param pluginName - The name of the plugin (must match the plugin ID)
 * @param methodSignatures - Object with method signatures (values are ignored, only types matter)
 * @returns Object with the same keys, but values are direct method wrappers
 */
export function createDirectExports<
  TPluginName extends string,
  TMethods extends Record<string, (...args: any[]) => any>,
>(pluginName: TPluginName, methodSignatures: TMethods): TMethods {
  const exports: Record<string, any> = {};

  for (const methodName of Object.keys(methodSignatures)) {
    exports[methodName] = (...args: any[]): any => {
      const kernel = getGlobalKernel();
      const plugin = kernel.get(pluginName);
      const method = (plugin as any)[methodName];

      if (typeof method !== 'function') {
        throw new Error(
          `Method ${methodName} not found in plugin ${pluginName}. ` +
            `Make sure the plugin is registered and the kernel is started.`
        );
      }

      return method(...args);
    };
  }

  return exports as TMethods;
}
