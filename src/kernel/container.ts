/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Plugin Instance container
 * @description Manages lifecycle of instances
 */

import type { PluginId, Result } from '@/core';
import type { BuiltPlugin, PluginRegistry } from '@/plugin';
import { success, failure, PluginNotFoundError, PluginLoadError } from '@/core';
import { createPluginRegistry } from '@/plugin';

export interface PluginContainer {
  register<
    TName extends string,
    TApi,
    TExt = unknown,
    TMetadata = unknown,
    TStore extends Record<string, any> = Record<string, any>,
  >(
    plugin: BuiltPlugin<TName, TApi, TExt, TMetadata, TStore>
  ): Result<void, PluginLoadError>;

  getInstance<TApi>(pluginName: string): Result<TApi, PluginNotFoundError>;

  setInstance<TApi>(pluginName: string, instance: TApi): Result<void, PluginNotFoundError>;

  hasInstance(pluginName: string): boolean;

  getRegistry(): PluginRegistry;
}

class PluginContainerImpl implements PluginContainer {
  private registry: PluginRegistry;
  private instances = new Map<string, unknown>();

  constructor() {
    this.registry = createPluginRegistry();
  }

  register<
    TName extends string,
    TApi,
    TExt = unknown,
    TMetadata = unknown,
    TStore extends Record<string, any> = Record<string, any>,
  >(plugin: BuiltPlugin<TName, TApi, TExt, TMetadata, TStore>): Result<void, PluginLoadError> {
    return this.registry.register(plugin);
  }

  getInstance<TApi>(pluginName: string): Result<TApi, PluginNotFoundError> {
    const instance = this.instances.get(pluginName);
    if (!instance) {
      return failure(new PluginNotFoundError(pluginName));
    }

    return success(instance as TApi);
  }

  setInstance<TApi>(pluginName: string, instance: TApi): Result<void, PluginNotFoundError> {
    const pluginResult = this.registry.get(pluginName as PluginId);
    if (!pluginResult.success) {
      return failure(pluginResult.error);
    }

    this.instances.set(pluginName, instance);
    return success(undefined);
  }

  hasInstance(pluginName: string): boolean {
    return this.instances.has(pluginName);
  }

  getRegistry(): PluginRegistry {
    return this.registry;
  }
}

export function createPluginContainer(): PluginContainer {
  return new PluginContainerImpl();
}
