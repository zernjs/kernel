/**
 * @file Lifecycle context builder
 * @description Helper to build context objects for lifecycle hooks
 */

import type { PluginDependency, KernelContext, KernelConfig } from '@/core';
import { createPluginId, createKernelId } from '@/core';
import type { PluginContainer } from './container';

/**
 * Builds the plugins object with metadata and store for lifecycle hooks
 *
 * Returns plugins with:
 * - API methods (all plugin methods)
 * - $meta (name, version, id, custom metadata)
 * - $store (complete Store object with watch, computed, batch, etc.)
 *
 * @param container - Plugin container instance
 * @param pluginDependencies - Array of plugin dependencies
 * @returns Record mapping plugin names to their APIs with metadata and store
 */
export function buildPluginsWithMetadata(
  container: PluginContainer,
  pluginDependencies: readonly PluginDependency[]
): Record<string, unknown> {
  const plugins: Record<string, unknown> = {};
  const registry = container.getRegistry();

  for (const dep of pluginDependencies) {
    const depInstance = container.getInstance(dep.pluginId);
    const depMetadata = registry.get(createPluginId(dep.pluginId));

    if (depInstance.success && depMetadata.success) {
      const apiData = depInstance.data as Record<string, unknown>;
      const pluginData = depMetadata.data;

      const customMetadata =
        typeof pluginData.metadata === 'object' && pluginData.metadata !== null
          ? pluginData.metadata
          : {};

      plugins[dep.pluginId] = {
        ...apiData,
        $meta: {
          name: pluginData.name,
          version: pluginData.version,
          id: pluginData.id,
          ...customMetadata,
        },
        $store: pluginData.store,
      };
    }
  }

  return plugins;
}

/**
 * Creates a kernel context for lifecycle hooks
 *
 * @param config - Kernel configuration
 * @param container - Plugin container instance
 * @returns KernelContext with id, config, and get method
 */
export function buildKernelContext(
  config: KernelConfig,
  container: PluginContainer
): KernelContext {
  return {
    id: createKernelId('kernel'),
    config,
    get: <T>(name: string): T => {
      const result = container.getInstance(name);
      if (!result.success) throw result.error;
      return result.data as T;
    },
  };
}
