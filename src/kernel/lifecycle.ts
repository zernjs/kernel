/**
 * @file Plugin lifecycle manager
 * @description Manages ordered initialization and graceful shutdown
 */

import {
  KernelConfig,
  KernelContext,
  PluginState,
  Result,
  createPluginId,
  createKernelId,
} from '@/core';
import type { PluginContainer } from './container';
import type { ExtensionManager } from '@/extension';
import { success, failure, KernelInitializationError } from '@/core';
import { createDependencyResolver } from '@/plugin';

export interface LifecycleManager {
  initialize(
    container: PluginContainer,
    extensions: ExtensionManager,
    config: KernelConfig
  ): Promise<Result<void, KernelInitializationError>>;

  shutdown(): Promise<void>;
}

class LifecycleManagerImpl implements LifecycleManager {
  private initializationOrder: string[] = [];

  async initialize(
    container: PluginContainer,
    extensions: ExtensionManager,
    config: KernelConfig
  ): Promise<Result<void, KernelInitializationError>> {
    try {
      const registry = container.getRegistry();
      const plugins = registry.getAll();

      // Register all extensions and wrappers before initializing plugins so targets receive them
      for (const pluginMeta of plugins) {
        for (const ext of pluginMeta.extensions) {
          extensions.registerExtension(ext);
        }

        // Register wrappers if the plugin has any
        if (pluginMeta.wrappers && pluginMeta.wrappers.length > 0) {
          for (const wrapper of pluginMeta.wrappers) {
            extensions.registerEnhancedExtension({
              targetPluginId: wrapper.targetPluginId,
              wrappers: [wrapper],
            });
          }
        }
      }

      const resolver = createDependencyResolver();
      const orderResult = resolver.resolve(plugins);

      if (!orderResult.success) {
        return failure(new KernelInitializationError(orderResult.error));
      }

      this.initializationOrder = orderResult.data.map(id => {
        const plugin = plugins.find(p => p.id === id);
        return plugin?.name ?? id;
      });

      for (const pluginName of this.initializationOrder) {
        await this.initializePlugin(pluginName, container, extensions, config);
      }

      return success(undefined);
    } catch (error) {
      return failure(new KernelInitializationError(error as Error));
    }
  }

  private async initializePlugin(
    pluginName: string,
    container: PluginContainer,
    extensions: ExtensionManager,
    config: KernelConfig
  ): Promise<void> {
    const registry = container.getRegistry();

    registry.setState(createPluginId(pluginName), PluginState.LOADING);

    try {
      const pluginResult = registry.get(createPluginId(pluginName));
      if (!pluginResult.success) {
        throw pluginResult.error;
      }

      const plugin = pluginResult.data;

      const deps: Record<string, unknown> = {};
      for (const dep of plugin.dependencies) {
        const depInstance = container.getInstance(dep.pluginId);
        if (!depInstance.success) {
          throw depInstance.error;
        }
        deps[dep.pluginId] = depInstance.data;
      }

      const kernelContext: KernelContext = {
        id: createKernelId('kernel'),
        config,
        get: <T>(name: string): T => {
          const result = container.getInstance(name);
          if (!result.success) throw result.error;
          return result.data as T;
        },
      };

      const instance = plugin.setupFn({
        plugins: deps,
        kernel: kernelContext,
      });

      let finalInstance = instance;
      if (config.extensionsEnabled) {
        if (typeof instance === 'object' && instance !== null) {
          finalInstance = extensions.applyExtensions(pluginName, instance as object) as unknown;
        }
      }

      const setResult = container.setInstance(pluginName, finalInstance);
      if (!setResult.success) {
        throw setResult.error;
      }

      registry.setState(createPluginId(pluginName), PluginState.LOADED);
    } catch (error) {
      registry.setState(createPluginId(pluginName), PluginState.ERROR);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    const shutdownOrder = [...this.initializationOrder].reverse();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _pluginName of shutdownOrder) {
      // TODO: Implement plugin shutdown logic
      // for now, just clear the references
    }

    this.initializationOrder = [];
  }
}

export function createLifecycleManager(): LifecycleManager {
  return new LifecycleManagerImpl();
}
