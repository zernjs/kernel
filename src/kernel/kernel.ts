/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Kernel builder with fluent API
 * @description Manages plugins and extensions with type-safe
 */

import type { KernelId, KernelConfig } from '@/core';
import { createKernelId, KernelInitializationError } from '@/core';
import type { BuiltPlugin } from '@/plugin';
import { PluginContainer, createPluginContainer } from './container';
import { LifecycleManager, createLifecycleManager } from './lifecycle';
import { createExtensionManager } from '@/extension';
import { setGlobalKernel } from '@/hooks';
import type { PluginsMap } from '@/utils/types';
import type { ProxyConfig, ProxyMetadata } from '@/extension/proxy-types';

// Initialized Kernel
export interface Kernel<TPlugins = Record<string, unknown>> {
  readonly id: KernelId;
  readonly config: KernelConfig;
  get<TName extends keyof TPlugins>(name: TName): TPlugins[TName];
  shutdown(): Promise<void>;
}

// Kernel Built (before initialization)
export interface BuiltKernel<TPlugins> {
  init(): Promise<Kernel<TPlugins>>;
}

// Builder Kernel
export interface KernelBuilder<U extends BuiltPlugin<string, unknown, unknown, unknown> = never> {
  use<P extends BuiltPlugin<string, unknown, unknown, unknown>>(plugin: P): KernelBuilder<U | P>;

  withConfig(config: Partial<KernelConfig>): KernelBuilder<U>;

  // Proxy methods - allows kernel-level proxying
  // 1. Single plugin proxy: proxy specific plugin
  proxy<TTargetName extends string, TTargetApi>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown, unknown>,
    config: ProxyConfig<TTargetApi>
  ): KernelBuilder<U>;

  // 2. Global proxy: proxy all plugins in kernel
  proxy(target: '**', config: ProxyConfig<any>): KernelBuilder<U>;

  build(): BuiltKernel<PluginsMap<U>>;

  start(): Promise<Kernel<PluginsMap<U>>>;
}

// Builder Implementation
class KernelBuilderImpl<U extends BuiltPlugin<string, unknown, unknown, unknown> = never>
  implements KernelBuilder<U>
{
  private plugins: BuiltPlugin<string, unknown, unknown, unknown>[] = [];
  private kernelProxies: ProxyMetadata[] = [];
  private config: KernelConfig = {
    autoGlobal: true,
    strictVersioning: true,
    circularDependencies: false,
    initializationTimeout: 30000,
    extensionsEnabled: true,
    logLevel: 'info',
  };

  use<P extends BuiltPlugin<string, unknown, unknown, unknown>>(plugin: P): KernelBuilder<U | P> {
    this.plugins.push(plugin as BuiltPlugin<string, unknown, unknown, unknown>);
    return this as unknown as KernelBuilder<U | P>;
  }

  withConfig(config: Partial<KernelConfig>): KernelBuilder<U> {
    this.config = { ...this.config, ...config };
    return this as unknown as KernelBuilder<U>;
  }

  // Proxy method - supports single plugin or global proxy
  proxy(targetOrSymbol: any, config?: any): KernelBuilder<U> {
    if (config === undefined) {
      // Should not happen - proxy() requires 2 arguments
      throw new Error('Kernel proxy requires a target and config');
    }

    if (targetOrSymbol === '**') {
      // Global proxy: proxy all plugins
      this.kernelProxies.push({
        targetPluginId: '**',
        config: config as any,
      });
    } else {
      // Single plugin proxy
      const target = targetOrSymbol as BuiltPlugin<string, unknown, unknown, unknown>;
      this.kernelProxies.push({
        targetPluginId: target.id,
        config: config as any,
      });
    }

    return this as unknown as KernelBuilder<U>;
  }

  build(): BuiltKernel<PluginsMap<U>> {
    return new BuiltKernelImpl<U>(this.plugins, this.kernelProxies, this.config);
  }

  async start(): Promise<Kernel<PluginsMap<U>>> {
    return this.build().init();
  }
}

// Built Kernel Implementation
class BuiltKernelImpl<U extends BuiltPlugin<string, unknown, unknown, unknown>>
  implements BuiltKernel<PluginsMap<U>>
{
  constructor(
    private readonly plugins: readonly BuiltPlugin<string, unknown, unknown, unknown>[],
    private readonly kernelProxies: readonly ProxyMetadata[],
    private readonly config: KernelConfig
  ) {}
  async init(): Promise<Kernel<PluginsMap<U>>> {
    try {
      const kernelId = createKernelId(`kernel-${Date.now()}`);

      const container = createPluginContainer();
      const lifecycle = createLifecycleManager();
      const extensions = createExtensionManager();

      for (const plugin of this.plugins) {
        const result = container.register(plugin);
        if (!result.success) {
          throw result.error;
        }
      }

      const initResult = await lifecycle.initialize(
        container,
        extensions,
        this.config,
        this.kernelProxies
      );

      if (!initResult.success) {
        throw initResult.error;
      }

      const kernel = new KernelImpl<PluginsMap<U>>(kernelId, this.config, container, lifecycle);

      if (this.config.autoGlobal) {
        setGlobalKernel(kernel as Kernel<PluginsMap<U>>);
      }

      return kernel;
    } catch (error) {
      throw new KernelInitializationError(error as Error);
    }
  }
}

// Implementation of initialized kernel
class KernelImpl<TPlugins> implements Kernel<TPlugins> {
  constructor(
    readonly id: KernelId,
    readonly config: KernelConfig,
    private readonly container: PluginContainer,
    private readonly lifecycle: LifecycleManager
  ) {}

  get<TName extends keyof TPlugins>(name: TName): TPlugins[TName] {
    const result = this.container.getInstance(name as string);
    if (!result.success) {
      throw result.error;
    }
    return result.data as TPlugins[TName];
  }

  async shutdown(): Promise<void> {
    await this.lifecycle.shutdown(this.container, this.config);
  }
}

export function createKernel(): KernelBuilder<never> {
  return new KernelBuilderImpl<never>();
}
