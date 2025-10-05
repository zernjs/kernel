/* eslint-disable @typescript-eslint/no-explicit-any */

import type { KernelId, KernelConfig } from '@/core';
import { createKernelId, KernelInitializationError } from '@/core';
import type { BuiltPlugin } from '@/plugin';
import { PluginContainer, createPluginContainer } from './container';
import { LifecycleManager, createLifecycleManager } from './lifecycle';
import { createExtensionManager } from '@/extension';
import { setGlobalKernel } from '@/hooks';
import type { PluginsMap } from '@/utils/types';
import type { ProxyConfig, ProxyMetadata } from '@/extension/proxy-types';
import { validateProxyConfig } from '@/extension/proxy-types';

export interface Kernel<TPlugins = Record<string, unknown>> {
  readonly id: KernelId;
  readonly config: KernelConfig;
  get<TName extends keyof TPlugins>(name: TName): TPlugins[TName];
  shutdown(): Promise<void>;
}

export interface BuiltKernel<TPlugins> {
  init(): Promise<Kernel<TPlugins>>;
}

export interface KernelBuilder<
  U extends BuiltPlugin<string, unknown, unknown, unknown, any> = never,
> {
  /**
   * Registers a plugin with the kernel.
   *
   * @param plugin - The built plugin to register
   * @returns Kernel builder with updated plugin types
   *
   * @example
   * ```typescript
   * const kernel = createKernel()
   *   .use(databasePlugin)
   *   .use(authPlugin);
   * ```
   */
  use<P extends BuiltPlugin<string, unknown, unknown, unknown, any>>(
    plugin: P
  ): KernelBuilder<U | P>;

  /**
   * Configures kernel behavior.
   *
   * @param config - Partial kernel configuration
   * @returns Kernel builder
   *
   * @example
   * ```typescript
   * const kernel = createKernel()
   *   .withConfig({
   *     strictVersioning: true,
   *     initializationTimeout: 5000
   *   });
   * ```
   */
  withConfig(config: Partial<KernelConfig>): KernelBuilder<U>;

  /**
   * Intercepts calls to a specific plugin at the kernel level.
   *
   * @param target - The plugin to intercept
   * @param config - Proxy configuration
   * @returns Kernel builder
   *
   * @example
   * ```typescript
   * const kernel = createKernel()
   *   .use(apiPlugin)
   *   .proxy(apiPlugin, {
   *     before: ctx => checkAuth(ctx.method)
   *   });
   * ```
   */
  proxy<
    TTargetName extends string,
    TTargetApi,
    TTargetExtMap = unknown,
    TTargetMetadata = unknown,
    TTargetStore extends Record<string, any> = Record<string, any>,
  >(
    target: BuiltPlugin<TTargetName, TTargetApi, TTargetExtMap, TTargetMetadata, TTargetStore>,
    config: ProxyConfig<TTargetStore>
  ): KernelBuilder<U>;

  /**
   * Intercepts calls to all plugins in the kernel.
   *
   * @param target - Must be '**' for global interception
   * @param config - Proxy configuration
   * @returns Kernel builder
   *
   * @example
   * ```typescript
   * const kernel = createKernel()
   *   .proxy('**', {
   *     before: ctx => console.log(`${ctx.plugin}.${ctx.method}()`)
   *   });
   * ```
   */
  proxy(target: '**', config: ProxyConfig<any>): KernelBuilder<U>;

  /**
   * Builds the kernel without initializing plugins.
   *
   * @returns Built kernel ready for initialization
   */
  build(): BuiltKernel<PluginsMap<U>>;

  /**
   * Builds and initializes the kernel with all plugins.
   *
   * @returns Promise resolving to initialized kernel
   *
   * @example
   * ```typescript
   * const kernel = await createKernel()
   *   .use(databasePlugin)
   *   .use(authPlugin)
   *   .start();
   *
   * const db = kernel.get('database');
   * ```
   */
  start(): Promise<Kernel<PluginsMap<U>>>;
}

class KernelBuilderImpl<
  U extends BuiltPlugin<string, unknown, unknown, unknown, Record<string, any>> = never,
> implements KernelBuilder<U>
{
  private plugins: BuiltPlugin<string, unknown, unknown, unknown, Record<string, any>>[] = [];
  private kernelProxies: ProxyMetadata[] = [];
  private config: KernelConfig = {
    autoGlobal: true,
    strictVersioning: true,
    circularDependencies: false,
    initializationTimeout: 30000,
    extensionsEnabled: true,
    logLevel: 'info',
  };

  use<P extends BuiltPlugin<string, unknown, unknown, unknown, any>>(
    plugin: P
  ): KernelBuilder<U | P> {
    this.plugins.push(plugin as BuiltPlugin<string, unknown, unknown, unknown, any>);
    return this as unknown as KernelBuilder<U | P>;
  }

  withConfig(config: Partial<KernelConfig>): KernelBuilder<U> {
    this.config = { ...this.config, ...config };
    return this as unknown as KernelBuilder<U>;
  }

  proxy(targetOrSymbol: any, config?: any): KernelBuilder<U> {
    if (config === undefined) {
      throw new Error('Kernel proxy requires a target and config');
    }

    validateProxyConfig(config);

    if (targetOrSymbol === '**') {
      this.kernelProxies.push({
        targetPluginId: '**',
        config: config as any,
      });
    } else {
      const target = targetOrSymbol as BuiltPlugin<
        string,
        unknown,
        unknown,
        unknown,
        Record<string, any>
      >;
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

class BuiltKernelImpl<U extends BuiltPlugin<string, unknown, unknown, unknown, Record<string, any>>>
  implements BuiltKernel<PluginsMap<U>>
{
  constructor(
    private readonly plugins: readonly BuiltPlugin<
      string,
      unknown,
      unknown,
      unknown,
      Record<string, any>
    >[],
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

/**
 * Creates a new kernel for managing plugins.
 *
 * @returns A kernel builder for configuring plugins and initialization
 *
 * @example
 * ```typescript
 * const kernel = await createKernel()
 *   .use(databasePlugin)
 *   .use(authPlugin)
 *   .start();
 * ```
 */
export function createKernel(): KernelBuilder<never> {
  return new KernelBuilderImpl<never>();
}
