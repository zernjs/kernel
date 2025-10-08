/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Plugin Instance container
 * @description Manages lifecycle of instances
 */

import type { Result } from '@/core';
import { createPluginId } from '@/core';
import type { BuiltPlugin, PluginRegistry } from '@/plugin';
import { success, failure } from '@/core';
import { PluginNotFoundError, PluginLoadError } from '@/errors';
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

  getInstanceWithMeta<TApi, TStore extends Record<string, any>, TMetadata>(
    pluginName: string
  ): Result<
    {
      api: TApi;
      store: import('@/store').Store<TStore>;
      metadata: TMetadata & { name: string; version: string };
    },
    PluginNotFoundError
  >;

  getOriginalInstance<TApi>(pluginName: string): Result<TApi, PluginNotFoundError>;

  setInstance<TApi>(pluginName: string, instance: TApi): Result<void, PluginNotFoundError>;

  hasInstance(pluginName: string): boolean;

  getRegistry(): PluginRegistry;
}

class PluginContainerImpl implements PluginContainer {
  private registry: PluginRegistry;
  private instances = new Map<string, unknown>();
  private originalInstances = new Map<string, unknown>();

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
      return failure(
        new PluginNotFoundError({
          plugin: pluginName,
          availablePlugins: Array.from(this.instances.keys()),
        })
      );
    }

    return success(instance as TApi);
  }

  getInstanceWithMeta<TApi, TStore extends Record<string, any>, TMetadata>(
    pluginName: string
  ): Result<
    {
      api: TApi;
      store: import('@/store').Store<TStore>;
      metadata: TMetadata & { name: string; version: string };
    },
    PluginNotFoundError
  > {
    const instance = this.instances.get(pluginName);
    if (!instance) {
      return failure(
        new PluginNotFoundError({
          plugin: pluginName,
          availablePlugins: Array.from(this.instances.keys()),
        })
      );
    }

    const pluginResult = this.registry.get(createPluginId(pluginName));
    if (!pluginResult.success) {
      return failure(pluginResult.error);
    }

    const plugin = pluginResult.data;

    const metadata = {
      name: plugin.name,
      version: plugin.version,
      ...(typeof plugin.metadata === 'object' && plugin.metadata !== null ? plugin.metadata : {}),
    } as TMetadata & { name: string; version: string };

    return success({
      api: instance as TApi,
      store: plugin.store as import('@/store').Store<TStore>,
      metadata,
    });
  }

  setInstance<TApi>(pluginName: string, instance: TApi): Result<void, PluginNotFoundError> {
    const pluginResult = this.registry.get(createPluginId(pluginName));
    if (!pluginResult.success) {
      return failure(pluginResult.error);
    }

    if (!this.originalInstances.has(pluginName)) {
      this.originalInstances.set(pluginName, instance);
    }

    this.instances.set(pluginName, instance);
    return success(undefined);
  }

  getOriginalInstance<TApi>(pluginName: string): Result<TApi, PluginNotFoundError> {
    const instance = this.originalInstances.get(pluginName);
    if (!instance) {
      return this.getInstance(pluginName);
    }
    return success(instance as TApi);
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
