/**
 * @file Centralized plugin registry for the Zern Kernel
 * @description Manages plugin lifecycle and states
 */

import type { PluginId, PluginMetadata, Result } from '@/core';
import { success, failure, PluginNotFoundError, PluginLoadError, PluginState } from '@/core';
import type { BuiltPlugin } from './plugin';

export interface PluginRegistry {
  register<TName extends string, TApi, TExt = unknown, TMetadata = unknown, TStore = unknown>(
    plugin: BuiltPlugin<TName, TApi, TExt, TMetadata, TStore>
  ): Result<void, PluginLoadError>;

  get<TApi>(
    pluginId: PluginId
  ): Result<BuiltPlugin<string, TApi, unknown, unknown, unknown>, PluginNotFoundError>;

  getMetadata(pluginId: PluginId): Result<PluginMetadata, PluginNotFoundError>;

  setState(pluginId: PluginId, state: PluginState): Result<void, PluginNotFoundError>;

  getAll(): readonly PluginMetadata[];

  clear(): void;
}

export class PluginRegistryImpl implements PluginRegistry {
  private plugins = new Map<PluginId, BuiltPlugin<string, unknown, unknown, unknown, unknown>>();
  private states = new Map<PluginId, PluginState>();

  register<TName extends string, TApi, TExt = unknown, TMetadata = unknown, TStore = unknown>(
    plugin: BuiltPlugin<TName, TApi, TExt, TMetadata, TStore>
  ): Result<void, PluginLoadError> {
    try {
      if (this.plugins.has(plugin.id)) {
        return failure(new PluginLoadError(plugin.name, new Error('Plugin already registered')));
      }

      this.plugins.set(
        plugin.id,
        plugin as BuiltPlugin<string, unknown, unknown, unknown, unknown>
      );
      this.states.set(plugin.id, PluginState.UNLOADED);

      return success(undefined);
    } catch (error) {
      return failure(new PluginLoadError(plugin.name, error as Error));
    }
  }

  get<TApi>(
    pluginId: PluginId
  ): Result<BuiltPlugin<string, TApi, unknown, unknown, unknown>, PluginNotFoundError> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return failure(new PluginNotFoundError(pluginId));
    }

    return success(plugin as BuiltPlugin<string, TApi, unknown, unknown, unknown>);
  }

  getMetadata(pluginId: PluginId): Result<PluginMetadata, PluginNotFoundError> {
    const plugin = this.plugins.get(pluginId);
    const state = this.states.get(pluginId);

    if (!plugin || state == undefined) {
      return failure(new PluginNotFoundError(pluginId));
    }

    return success({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      state,
      dependencies: plugin.dependencies,
      extensions: plugin.extensions,
      proxies: plugin.proxies,
    });
  }

  setState(pluginId: PluginId, state: PluginState): Result<void, PluginNotFoundError> {
    if (!this.plugins.has(pluginId)) {
      return failure(new PluginNotFoundError(pluginId));
    }

    this.states.set(pluginId, state);
    return success(undefined);
  }

  getAll(): readonly PluginMetadata[] {
    const metadata: PluginMetadata[] = [];

    for (const [pluginId, plugin] of this.plugins) {
      const state = this.states.get(pluginId) ?? PluginState.UNLOADED;
      metadata.push({
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        state,
        dependencies: plugin.dependencies,
        extensions: plugin.extensions,
        proxies: plugin.proxies,
      });
    }

    return metadata;
  }

  clear(): void {
    this.plugins.clear();
    this.states.clear();
  }
}

export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistryImpl();
}
