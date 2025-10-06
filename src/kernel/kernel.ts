/* eslint-disable @typescript-eslint/no-explicit-any */

import type { KernelId, KernelConfig } from '@/core';
import { createKernelId } from '@/core';
import { KernelInitializationError, ConfigurationError, ErrorSeverity, solution } from '@/errors';
import type { BuiltPlugin } from '@/plugin';
import { PluginContainer, createPluginContainer } from './container';
import { LifecycleManager, createLifecycleManager } from './lifecycle';
import { createExtensionManager } from '@/extension';
import { setGlobalKernel } from '@/hooks';
import type { PluginsMap } from '@/utils/types';
import type { ProxyConfig, ProxyMetadata, ProxyGlobalWildcard } from '@/extension/proxy-types';
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
   * Configures kernel behavior including error handling.
   *
   * @param config - Partial kernel configuration
   * @returns Kernel builder
   *
   * @example
   * ```typescript
   * const kernel = createKernel()
   *   .config({
   *     strictVersioning: true,
   *     initializationTimeout: 5000,
   *     errors: {
   *       showSolutions: true,
   *       enableColors: true
   *     }
   *   });
   * ```
   */
  config(config: Partial<KernelConfig>): KernelBuilder<U>;

  /**
   * Intercepts calls to a specific plugin at the kernel level.
   *
   * @param target - The plugin instance to intercept
   * @param config - Proxy configuration with before/after/around/onError hooks
   * @returns Kernel builder
   *
   * @remarks
   * Kernel-level proxies are applied AFTER plugin initialization, allowing you to
   * intercept methods without modifying the plugin itself. Useful for application-wide
   * concerns like authentication checks, rate limiting, or request logging.
   *
   * @example
   * ```typescript
   * const kernel = createKernel()
   *   .use(apiPlugin)
   *   .use(databasePlugin)
   *   .proxy(apiPlugin, {
   *     before: ctx => {
   *       if (!isAuthenticated()) {
   *         throw new Error('Unauthorized');
   *       }
   *     }
   *   })
   *   .proxy(databasePlugin, {
   *     around: async (ctx, next) => {
   *       console.log(`[DB] ${ctx.method} starting...`);
   *       const result = await next();
   *       console.log(`[DB] ${ctx.method} completed`);
   *       return result;
   *     }
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
   * Intercepts calls to ALL plugins in the kernel (global kernel proxy).
   *
   * @param target - `'**'` - Proxies **ALL methods** of **EVERY plugin** at application level.
   * Perfect for app-wide monitoring, auth checks, rate limiting, error boundaries.
   * @param config - Proxy configuration with before/after/around/onError hooks
   * @returns Kernel builder
   *
   * @remarks
   * The `'**'` wildcard at kernel level creates application-wide interception for
   * ALL plugin methods. This is applied OUTSIDE the plugins themselves, making it
   * perfect for cross-cutting concerns at the application layer.
   *
   * **Full Type Safety:**
   * - `ctx.pluginName` - Name of the plugin being intercepted (string)
   * - `ctx.plugins.<pluginName>` - Access plugin API with autocomplete
   * - `ctx.plugins.<pluginName>.$store` - Access plugin's reactive store
   * - `ctx.plugins.<pluginName>.$meta` - Access plugin's metadata
   *
   * **Difference from plugin-level `'**'`:**
   * - **Kernel proxy**: Applied at application level, after all plugins are initialized
   * - **Plugin proxy**: Applied at plugin level, can be distributed with the plugin
   *
   * Use kernel-level `'**'` for:
   * - Application-specific monitoring
   * - Environment-based behavior (dev/prod)
   * - Request/response transformation
   * - Global error boundaries
   *
   * @example
   * ```typescript
   * const kernel = createKernel()
   *   .use(authPlugin)
   *   .use(apiPlugin)
   *   .use(databasePlugin)
   *   .proxy('**', {                    // '**' = ALL plugins in this kernel
   *     before: ctx => {
   *       // ✅ Full autocomplete for all registered plugins!
   *       ctx.plugins.auth.checkPermission();
   *       ctx.plugins.api.$store.requestCount++;
   *       console.log(`[APP] ${ctx.pluginName}.${ctx.method}(`, ...ctx.args, ')')
   *     },
   *     after: (result, ctx) => {
   *       console.log(`[APP] ${ctx.pluginName}.${ctx.method} =>`, result);
   *       return result;
   *     },
   *     onError: (error, ctx) => {
   *       console.error(`[APP ERROR] ${ctx.pluginName}.${ctx.method}:`, error);
   *       // Send to error tracking service
   *       trackError({ plugin: ctx.pluginName, method: ctx.method, error });
   *       throw error;
   *     }
   *   });
   * ```
   */
  proxy(
    target: ProxyGlobalWildcard,
    config: ProxyConfig<Record<string, any>, import('@/utils/types').ProxyPluginsMapForKernel<U>>
  ): KernelBuilder<U>;

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
  private kernelConfig: KernelConfig = {
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

  config(config: Partial<KernelConfig>): KernelBuilder<U> {
    this.kernelConfig = { ...this.kernelConfig, ...config };
    return this as unknown as KernelBuilder<U>;
  }

  proxy(targetOrSymbol: any, config?: any): KernelBuilder<U> {
    if (config === undefined) {
      throw new ConfigurationError(
        { context: 'kernel.proxy()' },
        {
          severity: ErrorSeverity.ERROR,
          solutions: [
            solution(
              'Provide both target and config',
              'The proxy method requires two arguments: target and config',
              '.proxy(targetPlugin, { before: ctx => {...} })'
            ),
            solution(
              'For global proxies, use "**" as target',
              'To proxy all plugins, use the special "**" wildcard',
              '.proxy("**", { before: ctx => {...} })'
            ),
          ],
        }
      );
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
    return new BuiltKernelImpl<U>(this.plugins, this.kernelProxies, this.kernelConfig);
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
    private readonly kernelConfig: KernelConfig
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
        this.kernelConfig,
        this.kernelProxies
      );

      if (!initResult.success) {
        throw initResult.error;
      }

      const kernel = new KernelImpl<PluginsMap<U>>(
        kernelId,
        this.kernelConfig,
        container,
        lifecycle
      );

      if (this.kernelConfig.autoGlobal) {
        setGlobalKernel(kernel as Kernel<PluginsMap<U>>);
      }

      return kernel;
    } catch (error) {
      throw new KernelInitializationError({ cause: error as Error });
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
