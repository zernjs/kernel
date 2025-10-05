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
  PluginDependency,
} from '@/core';
import type { PluginContainer } from './container';
import type { ExtensionManager } from '@/extension';
import { success, failure, KernelInitializationError } from '@/core';
import { createDependencyResolver } from '@/plugin';
import type { ProxyMetadata } from '@/extension/proxy-types';

export interface LifecycleManager {
  initialize(
    container: PluginContainer,
    extensions: ExtensionManager,
    config: KernelConfig,
    kernelProxies?: readonly ProxyMetadata[]
  ): Promise<Result<void, KernelInitializationError>>;

  shutdown(container?: PluginContainer, config?: KernelConfig): Promise<void>;
}

class LifecycleManagerImpl implements LifecycleManager {
  private initializationOrder: string[] = [];

  /**
   * Builds the plugins object with metadata for lifecycle hooks
   */
  private buildPluginsWithMetadata(
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
        const customMetadata =
          typeof depMetadata.data.metadata === 'object' && depMetadata.data.metadata !== null
            ? depMetadata.data.metadata
            : {};

        plugins[dep.pluginId] = {
          ...apiData,
          $meta: {
            name: depMetadata.data.name,
            version: depMetadata.data.version,
            id: depMetadata.data.id,
            ...customMetadata,
          },
        };
      }
    }

    return plugins;
  }

  async initialize(
    container: PluginContainer,
    extensions: ExtensionManager,
    config: KernelConfig,
    kernelProxies: readonly ProxyMetadata[] = []
  ): Promise<Result<void, KernelInitializationError>> {
    try {
      const registry = container.getRegistry();
      const plugins = registry.getAll();

      if (kernelProxies.length > 0) {
        for (const proxy of kernelProxies) {
          if (proxy.targetPluginId === '**') {
            for (const targetPlugin of plugins) {
              extensions.registerProxy({
                targetPluginId: targetPlugin.id,
                config: proxy.config,
              });
            }
          } else {
            extensions.registerProxy(proxy);
          }
        }
      }

      for (const pluginMeta of plugins) {
        for (const ext of pluginMeta.extensions) {
          extensions.registerExtension(ext);
        }

        if (pluginMeta.proxies && pluginMeta.proxies.length > 0) {
          for (const proxy of pluginMeta.proxies) {
            if (proxy.targetPluginId === 'self') {
              extensions.registerProxy({
                targetPluginId: pluginMeta.id,
                config: proxy.config,
              });
            } else if (proxy.targetPluginId === '*') {
              for (const dep of pluginMeta.dependencies) {
                extensions.registerProxy({
                  targetPluginId: dep.pluginId,
                  config: proxy.config,
                });
              }
            } else if (proxy.targetPluginId === '**') {
              for (const targetPlugin of plugins) {
                extensions.registerProxy({
                  targetPluginId: targetPlugin.id,
                  config: proxy.config,
                });
              }
            } else {
              extensions.registerProxy(proxy);
            }
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

      const pluginsWithMetadata = this.buildPluginsWithMetadata(container, plugin.dependencies);

      if (plugin.hooks.onInit) {
        const onInitContext = {
          pluginName,
          pluginId: plugin.id,
          kernel: kernelContext,
          plugins: pluginsWithMetadata,
          store: plugin.store,
        };
        await plugin.hooks.onInit(onInitContext as any);
      }

      const instance = plugin.setupFn({
        plugins: deps,
        kernel: kernelContext,
        store: plugin.store,
      });

      let finalInstance = instance;
      if (config.extensionsEnabled) {
        if (typeof instance === 'object' && instance !== null) {
          finalInstance = extensions.applyExtensions(
            pluginName,
            instance as object,
            plugin.store
          ) as unknown;
        }
      }

      const setResult = container.setInstance(pluginName, finalInstance);
      if (!setResult.success) {
        throw setResult.error;
      }

      registry.setState(createPluginId(pluginName), PluginState.LOADED);

      if (plugin.hooks.onReady) {
        const onReadyContext = {
          pluginName,
          pluginId: plugin.id,
          kernel: kernelContext,
          plugins: pluginsWithMetadata,
          store: plugin.store,
          api: finalInstance,
        };
        await plugin.hooks.onReady(onReadyContext as any);
      }
    } catch (error) {
      registry.setState(createPluginId(pluginName), PluginState.ERROR);

      const pluginResult = registry.get(createPluginId(pluginName));
      if (pluginResult.success && pluginResult.data.hooks.onError) {
        const kernelContext: KernelContext = {
          id: createKernelId('kernel'),
          config,
          get: <T>(name: string): T => {
            const result = container.getInstance(name);
            if (!result.success) throw result.error;
            return result.data as T;
          },
        };

        const pluginsWithMetadata = this.buildPluginsWithMetadata(
          container,
          pluginResult.data.dependencies
        );

        const onErrorContext = {
          pluginName,
          pluginId: pluginResult.data.id,
          kernel: kernelContext,
          plugins: pluginsWithMetadata,
          store: pluginResult.data.store,
        };

        try {
          await pluginResult.data.hooks.onError(error as Error, onErrorContext as any);
        } catch (hookError) {
          console.error(`Error hook failed for plugin ${pluginName}:`, hookError);
        }
      }

      throw error;
    }
  }

  async shutdown(container?: PluginContainer, config?: KernelConfig): Promise<void> {
    const shutdownOrder = [...this.initializationOrder].reverse();

    for (const pluginName of shutdownOrder) {
      if (container) {
        const registry = container.getRegistry();
        const pluginResult = registry.get(createPluginId(pluginName));

        if (pluginResult.success && pluginResult.data.hooks.onShutdown) {
          try {
            const kernelContext: KernelContext = {
              id: createKernelId('kernel'),
              config: config || {},
              get: <T>(name: string): T => {
                const result = container.getInstance(name);
                if (!result.success) throw result.error;
                return result.data as T;
              },
            };

            const pluginsWithMetadata = this.buildPluginsWithMetadata(
              container,
              pluginResult.data.dependencies
            );

            const instanceResult = container.getInstance(pluginName);
            const api = instanceResult.success ? instanceResult.data : undefined;

            const onShutdownContext = {
              pluginName,
              pluginId: pluginResult.data.id,
              kernel: kernelContext,
              plugins: pluginsWithMetadata,
              store: pluginResult.data.store,
              api,
            };

            await pluginResult.data.hooks.onShutdown(onShutdownContext as any);
          } catch (error) {
            console.error(`Shutdown hook failed for plugin ${pluginName}:`, error);
          }
        }
      }
    }

    this.initializationOrder = [];
  }
}

export function createLifecycleManager(): LifecycleManager {
  return new LifecycleManagerImpl();
}
