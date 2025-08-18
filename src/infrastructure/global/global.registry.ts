/**
 * @file Global plugin registry for managing plugin instances across the application.
 * Provides centralized access to plugins and their APIs.
 */

import type { PluginId, PluginName } from '../../shared/types/common.types.js';
import type { Plugin } from '../../domain/plugin/plugin.types.js';
import type { Result } from '../../shared/types/result.types.js';
import { success, failure } from '../../shared/types/result.types.js';
import { createPluginId } from '../../shared/types/common.types.js';

/**
 * Error thrown when plugin operations fail.
 */
export class GlobalRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly pluginId?: PluginId
  ) {
    super(message);
    this.name = 'GlobalRegistryError';
  }
}

/**
 * Plugin entry in the global registry.
 */
export interface GlobalPluginEntry {
  readonly plugin: Plugin;
  readonly api: unknown;
  readonly registeredAt: Date;
}

/**
 * Global plugin registry for centralized plugin management.
 */
export class GlobalPluginRegistry {
  private readonly plugins = new Map<PluginId, GlobalPluginEntry>();
  private readonly nameToId = new Map<PluginName, PluginId>();

  /**
   * Registers a plugin in the global registry.
   * @param plugin - Plugin to register
   * @param api - Plugin API instance
   * @returns Success or failure result
   */
  register(plugin: Plugin, api: unknown): Result<void, GlobalRegistryError> {
    try {
      const pluginId = createPluginId(plugin.name);

      if (this.plugins.has(pluginId)) {
        return failure(
          new GlobalRegistryError(
            `Plugin '${plugin.name}' is already registered`,
            'PLUGIN_ALREADY_REGISTERED',
            pluginId
          )
        );
      }

      const entry: GlobalPluginEntry = {
        plugin,
        api,
        registeredAt: new Date(),
      };

      this.plugins.set(pluginId, entry);
      this.nameToId.set(plugin.name, pluginId);

      return success(undefined);
    } catch (error) {
      return failure(
        new GlobalRegistryError(
          `Failed to register plugin '${plugin.name}': ${error}`,
          'REGISTRATION_FAILED'
        )
      );
    }
  }

  /**
   * Gets a plugin API by name.
   * @param name - Plugin name
   * @returns Plugin API or undefined if not found
   */
  get<T = unknown>(name: PluginName): T | undefined {
    const pluginId = this.nameToId.get(name);
    if (!pluginId) {
      return undefined;
    }

    const entry = this.plugins.get(pluginId);
    return entry?.api as T;
  }

  /**
   * Checks if a plugin is registered.
   * @param name - Plugin name
   * @returns True if plugin is registered
   */
  has(name: PluginName): boolean {
    return this.nameToId.has(name);
  }

  /**
   * Unregisters a plugin from the global registry.
   * @param name - Plugin name
   * @returns Success or failure result
   */
  unregister(name: PluginName): Result<void, GlobalRegistryError> {
    const pluginId = this.nameToId.get(name);
    if (!pluginId) {
      return failure(
        new GlobalRegistryError(`Plugin '${name}' is not registered`, 'PLUGIN_NOT_FOUND')
      );
    }

    this.plugins.delete(pluginId);
    this.nameToId.delete(name);

    return success(undefined);
  }

  /**
   * Gets all registered plugin names.
   * @returns Array of plugin names
   */
  getRegisteredNames(): readonly PluginName[] {
    return Array.from(this.nameToId.keys());
  }

  /**
   * Clears all registered plugins.
   */
  clear(): void {
    this.plugins.clear();
    this.nameToId.clear();
  }

  /**
   * Gets the number of registered plugins.
   * @returns Number of registered plugins
   */
  size(): number {
    return this.plugins.size;
  }
}

// Global registry instance
let globalRegistry: GlobalPluginRegistry | undefined;

/**
 * Gets the global plugin registry instance.
 * @returns Global registry instance
 */
export function getGlobalRegistry(): GlobalPluginRegistry {
  if (!globalRegistry) {
    globalRegistry = new GlobalPluginRegistry();
  }
  return globalRegistry;
}

/**
 * Resets the global registry (mainly for testing).
 */
export function resetGlobalRegistry(): void {
  globalRegistry = undefined;
}
