import type { Kernel } from '@/kernel';
import { KernelInitializationError } from '@/core';

/**
 * Strongly-typed accessors to plugin APIs, usable anywhere in the app.
 *
 * Patterns supported:
 * - createUsePlugin(kernel): returns a typed accessor bound to the provided kernel
 * - bindGlobalKernel(kernel): binds a kernel for global runtime access and returns a typed accessor
 * - usePlugin(name): global accessor that uses the bound kernel at runtime; types can be augmented via UsePluginTypes
 */

/**
 * Augmentation point for global usePlugin typing.
 *
 * Consumers may augment this interface via declaration merging to provide the
 * exact plugins map type for perfect autocomplete with the global usePlugin.
 *
 * declare module '@zern/kernel' {
 *   interface UsePluginTypes {
 *     plugins: {
 *       math: MathApi;
 *       logger: LoggerApi;
 *     };
 *   }
 * }
 */
export interface UsePluginTypes {
  readonly plugins: Record<string, unknown>;
}

// Derived alias for convenience
type GlobalPlugins = UsePluginTypes['plugins'];

// Runtime holder for a globally bound Kernel instance
let boundKernel: Kernel<GlobalPlugins> | undefined;

/**
 * Creates a typed accessor bound to a specific Kernel instance.
 * Use this when you want perfect typing without relying on global binding.
 */
export function createUsePlugin<TPlugins>(
  kernel: Kernel<TPlugins>
): <TName extends keyof TPlugins>(name: TName) => TPlugins[TName] {
  return name => kernel.get(name);
}

/**
 * Binds a Kernel instance for global runtime access and returns a typed accessor.
 * Call this AFTER createKernel().use(...).build().init() or .start().
 */
export function bindGlobalKernel<TPlugins>(
  kernel: Kernel<TPlugins>
): <TName extends keyof TPlugins>(name: TName) => TPlugins[TName] {
  boundKernel = kernel as unknown as Kernel<GlobalPlugins>;
  return createUsePlugin(kernel);
}

/**
 * Global accessor to plugin APIs using the bound Kernel instance.
 * Throws a descriptive error if called before the Kernel is bound/initialized.
 *
 * For perfect typing here, augment UsePluginTypes in your app or prefer
 * createUsePlugin(kernel) which captures the actual TPlugins.
 */
export function usePlugin<TName extends keyof GlobalPlugins>(name: TName): GlobalPlugins[TName] {
  if (!boundKernel) {
    throw new KernelInitializationError();
  }
  // Kernel.get throws PluginNotFoundError if the plugin is not available.
  return boundKernel.get(name);
}
