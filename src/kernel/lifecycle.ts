/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { success, failure } from '@/core';
import { KernelInitializationError } from '@/errors';
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
   * Builds the plugins object with metadata and store for lifecycle hooks
   *
   * Returns plugins with:
   * - API methods (all plugin methods)
   * - $meta (name, version, id, custom metadata)
   * - $store (complete Store object with watch, computed, batch, etc.)
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

  async initialize(
    container: PluginContainer,
    extensions: ExtensionManager,
    config: KernelConfig,
    kernelProxies: readonly ProxyMetadata[] = []
  ): Promise<Result<void, KernelInitializationError>> {
    try {
      const registry = container.getRegistry();
      const plugins = registry.getAll();

      for (const pluginMeta of plugins) {
        for (const ext of pluginMeta.extensions) {
          extensions.registerExtension(ext);
        }

        if (pluginMeta.proxies && pluginMeta.proxies.length > 0) {
          for (const proxy of pluginMeta.proxies) {
            if (proxy.targetPluginId === 'self') {
              extensions.registerProxy({
                targetPluginId: pluginMeta.id,
                sourcePluginId: pluginMeta.id,
                config: proxy.config,
              });
            } else if (proxy.targetPluginId === '*') {
              continue;
            } else if (proxy.targetPluginId === '**') {
              continue;
            } else {
              extensions.registerProxy({
                ...proxy,
                sourcePluginId: pluginMeta.id,
              });
            }
          }
        }
      }

      const resolver = createDependencyResolver();
      const orderResult = resolver.resolve(plugins);

      if (!orderResult.success) {
        return failure(new KernelInitializationError({ cause: orderResult.error }));
      }

      this.initializationOrder = orderResult.data.map(id => {
        const plugin = plugins.find(p => p.id === id);
        return plugin?.name ?? id;
      });

      for (const pluginName of this.initializationOrder) {
        await this.initializePlugin(pluginName, container, extensions, config);
      }

      await this.reapplyWildcardProxies(container, extensions, config);

      if (kernelProxies.length > 0) {
        await this.applyKernelProxies(kernelProxies, container, extensions, config);
      }

      return success(undefined);
    } catch (error) {
      return failure(new KernelInitializationError({ cause: error as Error }));
    }
  }

  /**
   * Applies wildcard proxies ('*' and '**') after all plugins are initialized.
   * This ensures that ctx.plugins has access to ALL plugins, not just those
   * initialized before the current plugin.
   */
  private async reapplyWildcardProxies(
    container: PluginContainer,
    extensions: ExtensionManager,
    config: KernelConfig
  ): Promise<void> {
    const registry = container.getRegistry();
    const allPlugins = registry.getAll();

    for (const pluginMeta of allPlugins) {
      if (pluginMeta.proxies && pluginMeta.proxies.length > 0) {
        for (const proxy of pluginMeta.proxies) {
          if (proxy.targetPluginId === '*') {
            for (const dep of pluginMeta.dependencies) {
              extensions.registerProxy({
                targetPluginId: dep.pluginId,
                sourcePluginId: pluginMeta.id,
                config: proxy.config,
              });
            }
          } else if (proxy.targetPluginId === '**') {
            for (const targetPlugin of allPlugins) {
              extensions.registerProxy({
                targetPluginId: targetPlugin.id,
                sourcePluginId: pluginMeta.id,
                config: proxy.config,
              });
            }
          }
        }
      }
    }

    const allPluginInfos: Record<string, import('@/extension').PluginInfo> = {};
    for (const p of allPlugins) {
      const pResult = registry.get(p.id);
      if (pResult.success) {
        const pInstance = container.getInstance(p.id);
        if (pInstance.success) {
          const pPlugin = pResult.data;
          allPluginInfos[pPlugin.name] = {
            api: pInstance.data,
            store: pPlugin.store,
            metadata: {
              name: pPlugin.name,
              version: pPlugin.version,
              ...(typeof pPlugin.metadata === 'object' && pPlugin.metadata !== null
                ? pPlugin.metadata
                : {}),
            },
          };
        }
      }
    }

    const proxySourceInfos: Record<string, import('@/extension').ProxySourceInfo> = {};
    for (const p of allPlugins) {
      const pResult = registry.get(p.id);
      if (pResult.success) {
        proxySourceInfos[p.id] = {
          store: pResult.data.store,
        };
      }
    }

    const targetsNeedingReapply = new Set<string>();

    for (const pluginMeta of allPlugins) {
      if (pluginMeta.proxies && pluginMeta.proxies.length > 0) {
        for (const proxy of pluginMeta.proxies) {
          if (proxy.targetPluginId === '*') {
            for (const dep of pluginMeta.dependencies) {
              targetsNeedingReapply.add(dep.pluginId);
            }
          } else if (proxy.targetPluginId === '**') {
            for (const targetPlugin of allPlugins) {
              targetsNeedingReapply.add(targetPlugin.name);
            }
          }
        }
      }
    }

    for (const targetName of targetsNeedingReapply) {
      const pluginResult = registry.get(createPluginId(targetName));
      if (!pluginResult.success) continue;

      const plugin = pluginResult.data;

      const originalInstanceResult = container.getOriginalInstance(targetName);
      if (!originalInstanceResult.success) continue;

      const originalInstance = originalInstanceResult.data;

      if (
        typeof originalInstance === 'object' &&
        originalInstance !== null &&
        config.extensionsEnabled
      ) {
        const newInstance = extensions.applyExtensions(
          plugin.name,
          originalInstance as object,
          plugin.store,
          {
            name: plugin.name,
            version: plugin.version,
            ...(typeof plugin.metadata === 'object' && plugin.metadata !== null
              ? plugin.metadata
              : {}),
          },
          allPluginInfos,
          proxySourceInfos,
          undefined
        );

        container.setInstance(plugin.name, newInstance);
      }
    }
  }

  private async applyKernelProxies(
    kernelProxies: readonly ProxyMetadata[],
    container: PluginContainer,
    extensions: ExtensionManager,
    config: KernelConfig
  ): Promise<void> {
    const registry = container.getRegistry();
    const allPlugins = registry.getAll();

    const allPluginInfos: Record<string, import('@/extension').PluginInfo> = {};
    for (const p of allPlugins) {
      const pResult = registry.get(p.id);
      if (pResult.success) {
        const pInstance = container.getInstance(p.id);
        if (pInstance.success) {
          const pPlugin = pResult.data;
          allPluginInfos[pPlugin.name] = {
            api: pInstance.data,
            store: pPlugin.store,
            metadata: {
              name: pPlugin.name,
              version: pPlugin.version,
              ...(typeof pPlugin.metadata === 'object' && pPlugin.metadata !== null
                ? pPlugin.metadata
                : {}),
            },
          };
        }
      }
    }

    for (const proxy of kernelProxies) {
      const targetsToProxy =
        proxy.targetPluginId === '**'
          ? allPlugins
          : allPlugins.filter(p => p.id === proxy.targetPluginId);

      for (const targetPlugin of targetsToProxy) {
        const pluginResult = registry.get(targetPlugin.id);
        if (!pluginResult.success) continue;

        const plugin = pluginResult.data;
        const instanceResult = container.getInstance(targetPlugin.id);
        if (!instanceResult.success) continue;

        const instance = instanceResult.data;

        if (typeof instance === 'object' && instance !== null && config.extensionsEnabled) {
          extensions.registerProxy({
            targetPluginId: targetPlugin.id,
            config: proxy.config,
          });

          const proxySourceInfos: Record<string, import('@/extension').ProxySourceInfo> = {};
          for (const p of allPlugins) {
            const pResult = registry.get(p.id);
            if (pResult.success) {
              proxySourceInfos[p.id] = {
                store: pResult.data.store,
              };
            }
          }

          const newInstance = extensions.applyExtensions(
            plugin.name,
            instance as object,
            plugin.store,
            {
              name: plugin.name,
              version: plugin.version,
              ...(typeof plugin.metadata === 'object' && plugin.metadata !== null
                ? plugin.metadata
                : {}),
            },
            allPluginInfos,
            proxySourceInfos,
            undefined
          );

          container.setInstance(plugin.name, newInstance);
        }
      }
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

      const instance = plugin.setupFn({
        plugins: pluginsWithMetadata,
        kernel: kernelContext,
        store: plugin.store,
      });

      if (plugin.hooks.onInit) {
        const onInitContext = {
          pluginName,
          pluginId: plugin.id,
          kernel: kernelContext,
          plugins: pluginsWithMetadata,
          store: plugin.store,
          phase: 'init' as const,
        };
        await plugin.hooks.onInit(onInitContext as any);
      }

      let finalInstance = instance;
      if (config.extensionsEnabled) {
        if (typeof instance === 'object' && instance !== null) {
          const onRuntimeError = plugin.hooks.onError
            ? async (
                error: Error,
                context: { pluginName: string; method: string }
              ): Promise<void> => {
                const errorContext = {
                  pluginName,
                  pluginId: plugin.id,
                  kernel: kernelContext,
                  plugins: pluginsWithMetadata,
                  store: plugin.store,
                  phase: 'runtime' as const,
                  method: context.method,
                };
                try {
                  await plugin.hooks.onError!(error, errorContext as any);
                } catch (hookError) {
                  console.error(`Error hook failed for plugin ${pluginName}:`, hookError);
                }
              }
            : undefined;

          const allPlugins = registry.getAll();
          const pluginInfos: Record<string, import('@/extension').PluginInfo> = {};

          for (const p of allPlugins) {
            const pResult = registry.get(p.id);
            if (pResult.success) {
              const pInstance = container.getInstance(p.id);
              if (pInstance.success) {
                const pPlugin = pResult.data;
                pluginInfos[pPlugin.name] = {
                  api: pInstance.data,
                  store: pPlugin.store,
                  metadata: {
                    name: pPlugin.name,
                    version: pPlugin.version,
                    ...(typeof pPlugin.metadata === 'object' && pPlugin.metadata !== null
                      ? pPlugin.metadata
                      : {}),
                  },
                };
              }
            }
          }

          const proxySourceInfos: Record<string, import('@/extension').ProxySourceInfo> = {};
          for (const p of allPlugins) {
            const pResult = registry.get(p.id);
            if (pResult.success) {
              proxySourceInfos[p.id] = {
                store: pResult.data.store,
              };
            }
          }

          finalInstance = extensions.applyExtensions(
            pluginName,
            instance as object,
            plugin.store,
            {
              name: plugin.name,
              version: plugin.version,
              ...(typeof plugin.metadata === 'object' && plugin.metadata !== null
                ? plugin.metadata
                : {}),
            },
            pluginInfos,
            proxySourceInfos,
            onRuntimeError
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
          phase: 'ready' as const,
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
          phase: 'init' as const,
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
              phase: 'shutdown' as const,
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
