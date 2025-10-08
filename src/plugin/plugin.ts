/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  KernelContext,
  PluginId,
  Version,
  PluginDependency,
  PluginExtension,
  PluginLifecycleHooks,
} from '@/core';
import { createPluginId, createVersion } from '@/core';
import type { DepsWithMetadata } from '@/utils/types';
import type {
  ProxyConfig,
  ProxyMetadata,
  ProxyTarget,
  ProxyDependenciesWildcard,
  ProxyGlobalWildcard,
  ProxyPluginAccess,
  ProxyPluginsMap,
} from '@/extension/proxy-types';
import { validateProxyConfig } from '@/extension/proxy-types';
import { createStore, isStore } from '@/store';
import type { Store } from '@/store';
import { PluginDependencyError, ErrorSeverity, solution } from '@/errors';

export interface PluginSetupContext<
  TDeps = Record<string, never>,
  TStore extends Record<string, any> = Record<string, never>,
> {
  readonly plugins: TDeps;
  readonly kernel: KernelContext;
  readonly store: Store<TStore>;
}

export interface BuiltPlugin<
  TName extends string,
  TApi,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
  TStore extends Record<string, any> = Record<string, never>,
> {
  readonly id: PluginId;
  readonly name: TName;
  readonly version: Version;
  readonly dependencies: readonly PluginDependency[];
  readonly extensions: readonly PluginExtension[];
  readonly proxies: readonly ProxyMetadata[];
  readonly hooks: PluginLifecycleHooks;
  readonly metadata: TMetadata;
  readonly store: Store<TStore>;
  readonly config: { errors?: import('@/errors').ErrorConfig } & Record<string, unknown>;
  readonly setupFn: (ctx: PluginSetupContext<Record<string, unknown>, TStore>) => TApi;
  readonly __extensions__?: TExtMap | undefined;

  proxy(config: ProxyConfig<TStore>): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore>;

  onInit(
    hook: PluginLifecycleHooks<Record<string, unknown>, TStore, never>['onInit']
  ): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore>;
  onReady(
    hook: PluginLifecycleHooks<Record<string, unknown>, TStore, TApi>['onReady']
  ): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore>;
  onShutdown(
    hook: PluginLifecycleHooks<Record<string, unknown>, TStore, TApi>['onShutdown']
  ): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore>;
  onError(
    hook: PluginLifecycleHooks<Record<string, unknown>, TStore, never>['onError']
  ): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore>;
}

export interface PluginBuilder<
  TName extends string,
  TApi = unknown,
  TDeps = Record<string, never>,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
  TStore extends Record<string, any> = Record<string, never>,
> {
  /**
   * Creates a reactive store for shared plugin state.
   *
   * @param factory - Function that returns the initial store state
   * @returns Plugin builder with store type
   *
   * @example
   * ```typescript
   * const dbPlugin = plugin('database', '1.0.0')
   *   .store(() => ({
   *     connection: null,
   *     queryCount: 0
   *   }))
   *   .setup(({ store }) => ({
   *     query: async (sql: string) => {
   *       store.queryCount++;
   *       return await store.connection.execute(sql);
   *     }
   *   }));
   * ```
   */
  store<TNewStore extends Record<string, any>>(
    factory: () => TNewStore
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TNewStore>;

  /**
   * Configures plugin-specific settings including error handling.
   *
   * @param config - Plugin configuration object
   * @returns Plugin builder
   *
   * @example
   * ```typescript
   * const mathPlugin = plugin('math', '1.0.0')
   *   .config({
   *     errors: {
   *       showSolutions: true,
   *       severity: ErrorSeverity.WARN
   *     }
   *   })
   *   .setup(() => ({ add: (a, b) => a + b }));
   * ```
   */
  config(
    config: { errors?: import('@/errors').ErrorConfig } & Record<string, unknown>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Attaches custom metadata to the plugin.
   *
   * @param metadata - Metadata object with custom properties
   * @returns Plugin builder with metadata type
   *
   * @example
   * ```typescript
   * const apiPlugin = plugin('api', '1.0.0')
   *   .metadata({
   *     author: 'Zern Team',
   *     category: 'network',
   *     rateLimit: 1000
   *   })
   *   .setup(() => ({ fetch: async (url: string) => {} }));
   * ```
   */
  metadata<TNewMetadata extends Record<string, unknown>>(
    metadata: TNewMetadata
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TNewMetadata, TStore>;

  /**
   * Defines the plugin's public API.
   *
   * @param fn - Function that receives context and returns the API object
   * @returns Built plugin ready for use
   *
   * @example
   * ```typescript
   * const mathPlugin = plugin('math', '1.0.0')
   *   .setup(() => ({
   *     add: (a: number, b: number) => a + b,
   *     multiply: (a: number, b: number) => a * b
   *   }));
   * ```
   */
  setup<TNewApi>(
    fn: (ctx: PluginSetupContext<TDeps, TStore>) => TNewApi
  ): BuiltPlugin<TName, TNewApi, TExtMap, TMetadata, TStore>;

  /**
   * Declares a dependency on another plugin with optional version constraint.
   *
   * @param plugin - The plugin to depend on
   * @param versionRange - Optional semantic version range (e.g., "^1.0.0", ">=2.0.0")
   * @returns Plugin builder with updated dependency types
   *
   * @example
   * ```typescript
   * const authPlugin = plugin('auth', '1.0.0')
   *   .depends(databasePlugin, '^1.0.0')
   *   .setup(({ plugins }) => ({
   *     login: async (username: string) => {
   *       // Access database plugin with full type safety
   *       return await plugins.database.users.findByUsername(username);
   *     }
   *   }));
   * ```
   */
  depends<
    TDepName extends string,
    TDepApi,
    TDepExtMap = unknown,
    TDepMetadata = unknown,
    TDepStore extends Record<string, any> = any,
  >(
    plugin: BuiltPlugin<TDepName, TDepApi, TDepExtMap, TDepMetadata, TDepStore>,
    versionRange?: string
  ): PluginBuilder<
    TName,
    TApi,
    TDeps & Record<TDepName, TDepApi & { __meta__?: TDepMetadata; __store__?: TDepStore }>,
    TExtMap,
    TMetadata,
    TStore
  >;

  /**
   * Extends another plugin's API with additional methods.
   *
   * @param target - The plugin to extend
   * @param fn - Function that receives the target API and returns extension methods
   * @returns Plugin builder with updated extension map
   *
   * @remarks
   * **About the `api` parameter:**
   *
   * At runtime, the `api` parameter includes:
   * - The target plugin's original API
   * - All extensions that other plugins have applied to it
   *
   * However, TypeScript cannot statically infer extensions from other plugins due to
   * the complexity of accumulated type intersections. Therefore, the `api` parameter
   * is typed as `TTargetApi & Record<string, any>` to allow accessing extension methods.
   *
   * **This means:**
   * - ✅ Your code will work correctly at runtime
   * - ⚠️ TypeScript won't provide autocomplete for extension methods from dependencies
   * - ⚠️ You won't get compile-time errors if you mistype extension method names
   *
   * Use with care and ensure your dependencies are correctly declared.
   *
   * @example
   * ```typescript
   * const advancedMathPlugin = plugin('advancedMath', '1.0.0')
   *   .depends(mathPlugin, '^1.0.0')
   *   .extend(mathPlugin, api => ({
   *     power: (base: number, exp: number) => Math.pow(base, exp),
   *     sqrt: (x: number) => Math.sqrt(x)
   *   }))
   *   .setup(() => ({}));
   *
   * // You can extend mathPlugin again, using advancedMath's extensions:
   * const moreExtensions = plugin('more', '1.0.0')
   *   .depends(mathPlugin, '^1.0.0')
   *   .depends(advancedMathPlugin, '^1.0.0')
   *   .extend(mathPlugin, api => ({
   *     // api.sqrt exists at runtime (from advancedMathPlugin)
   *     // but TypeScript can't infer it
   *     sqrt2: (x: number) => api.sqrt(x)
   *   }))
   *   .setup(() => ({}));
   * ```
   */
  extend<
    TTargetName extends string,
    TTargetApi,
    TTargetExtMap = unknown,
    TTargetMetadata = unknown,
    TTargetStore extends Record<string, any> = any,
    TExt extends object = object,
  >(
    target: BuiltPlugin<TTargetName, TTargetApi, TTargetExtMap, TTargetMetadata, TTargetStore>,
    fn: (api: TTargetApi & Record<string, any>) => TExt
  ): PluginBuilder<TName, TApi, TDeps, TExtMap & Record<TTargetName, TExt>, TMetadata, TStore>;

  /**
   * Intercepts calls to the plugin's own methods (self-proxy).
   *
   * @param config - Proxy configuration with before/after/around/onError hooks
   * @returns Plugin builder
   *
   * @example
   * ```typescript
   * const mathPlugin = plugin('math', '1.0.0')
   *   .store(() => ({ count: 0 }))
   *   .metadata({ version: '1.0.0' })
   *   .proxy({
   *     include: ['add'],
   *     before: ctx => {
   *       // ✅ ctx.store is YOUR store (typed)
   *       ctx.store.count++;
   *
   *       // ✅ ctx.plugins.math has your API + $store + $meta
   *       console.log(ctx.plugins.math.$store.count);
   *       console.log(ctx.plugins.math.$meta.version);
   *     }
   *   })
   *   .setup(() => ({
   *     add: (a: number, b: number) => a + b
   *   }));
   * ```
   */
  proxy(
    config: ProxyConfig<TStore, Record<TName, ProxyPluginAccess<TApi, TStore, TMetadata>>>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Intercepts calls to a specific dependency plugin's methods.
   *
   * @param target - The dependency plugin to intercept
   * @param config - Proxy configuration with before/after/around/onError hooks
   * @returns Plugin builder
   *
   * @example
   * ```typescript
   * const loggingPlugin = plugin('logging', '1.0.0')
   *   .store(() => ({ logCount: 0 }))
   *   .depends(mathPlugin, '^1.0.0')
   *   .proxy(mathPlugin, {
   *     before: ctx => {
   *       // ✅ ctx.store is YOUR store (loggingPlugin)
   *       ctx.store.logCount++;
   *
   *       // ✅ ctx.plugins.math has target plugin with $store and $meta
   *       ctx.plugins.math.$store.callCount++;
   *       console.log(ctx.plugins.math.$meta.version);
   *
   *       // ✅ Call target plugin methods
   *       const result = ctx.plugins.math.add(1, 2);
   *     }
   *   })
   *   .setup(() => ({}));
   * ```
   */
  proxy<
    TTargetName extends string,
    TTargetApi,
    TTargetExtMap = unknown,
    TTargetMetadata = unknown,
    TTargetStore extends Record<string, any> = any,
  >(
    target: BuiltPlugin<TTargetName, TTargetApi, TTargetExtMap, TTargetMetadata, TTargetStore>,
    config: ProxyConfig<
      TStore,
      Record<TTargetName, ProxyPluginAccess<TTargetApi, TTargetStore, TTargetMetadata>>
    >
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Intercepts calls to all dependency plugins' methods.
   *
   * @param target - `'*'` - Proxies **all methods** of **all plugins** you declared with `.depends()`.
   * Use this for timing, logging, or caching across multiple related plugins.
   * @param config - Proxy configuration with before/after/around/onError hooks
   * @returns Plugin builder
   *
   * @remarks
   * The `'*'` wildcard proxies ALL methods of ALL plugins you've declared as dependencies.
   * This is useful for cross-cutting concerns like timing, caching, or logging across
   * multiple related plugins.
   *
   * @example
   * ```typescript
   * const timingPlugin = plugin('timing', '1.0.0')
   *   .store(() => ({ timings: new Map() }))
   *   .depends(mathPlugin, '^1.0.0')    // Will be proxied
   *   .depends(apiPlugin, '^1.0.0')     // Will be proxied
   *   .proxy('*', {                     // '*' = all dependencies
   *     before: ctx => {
   *       // ✅ ctx.store is YOUR store (timingPlugin)
   *       ctx.store.timings.set(ctx.method, Date.now());
   *
   *       // ✅ ctx.plugins has ALL dependencies typed with $store and $meta
   *       ctx.plugins.math.$store.callCount++;
   *       ctx.plugins.api.$store.requestCount++;
   *
   *       // ✅ Call methods on any dependency
   *       ctx.plugins.math.add(1, 2);
   *       ctx.plugins.api.getUser(123);
   *     }
   *   })
   *   .setup(() => ({}));
   * ```
   */
  proxy<TDepsRecord extends Record<string, any> = TDeps & Record<string, any>>(
    target: ProxyDependenciesWildcard,
    config: ProxyConfig<TStore, ProxyPluginsMap<TDepsRecord>>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Intercepts calls to ALL plugins in the kernel (global proxy).
   *
   * @param target - `'**'` - Proxies **ALL methods** of **EVERY plugin** in the kernel (even non-dependencies).
   * Use carefully - affects the entire application. Good for global monitoring, error tracking, audit logs.
   * @param config - Proxy configuration with before/after/around/onError hooks
   * @returns Plugin builder
   *
   * @remarks
   * The `'**'` double wildcard creates a GLOBAL proxy that intercepts ALL methods of
   * ALL plugins registered in the kernel, even those not declared as dependencies.
   * Use this carefully - it affects every plugin method call in your application.
   *
   * Ideal for:
   * - Global performance monitoring
   * - Universal error tracking
   * - System-wide audit logging
   * - Debug tracing in development
   *
   * @example
   * ```typescript
   * const monitorPlugin = plugin('monitor', '1.0.0')
   *   .store(() => ({ calls: new Map<string, number>() }))
   *   .proxy('**', {                    // '**' = ALL kernel plugins
   *     before: ctx => {
   *       // ✅ ctx.store is YOUR store (monitorPlugin)
   *       const key = `${ctx.pluginName}.${ctx.method}`;
   *       const count = (ctx.store.calls.get(key) || 0) + 1;
   *       ctx.store.calls.set(key, count);
   *
   *       // ⚠️ ctx.plugins is 'any' - you don't know which plugins exist
   *       // Use ctx.pluginName to check dynamically
   *     }
   *   })
   *   .setup(({ store }) => ({
   *     getStats: () => Object.fromEntries(store.calls)
   *   }));
   * ```
   */
  proxy(
    target: ProxyGlobalWildcard,
    config: ProxyConfig<TStore, any>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Executes before the plugin's API is created.
   *
   * @param hook - Initialization function
   * @returns Plugin builder
   *
   * @example
   * ```typescript
   * const dbPlugin = plugin('database', '1.0.0')
   *   .onInit(async ({ store }) => {
   *     store.connection = await createConnection();
   *   })
   *   .setup(() => ({}));
   * ```
   */
  onInit(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore>['onInit']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Executes after all plugins are initialized and ready.
   *
   * @param hook - Ready callback function with access to plugin API
   * @returns Plugin builder
   *
   * @example
   * ```typescript
   * const apiPlugin = plugin('api', '1.0.0')
   *   .onReady(({ api }) => {
   *     console.log('API ready:', api.endpoints);
   *   })
   *   .setup(() => ({ endpoints: ['/users', '/posts'] }));
   * ```
   */
  onReady(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore, TApi>['onReady']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Executes when the kernel shuts down.
   *
   * @param hook - Shutdown callback for cleanup
   * @returns Plugin builder
   *
   * @example
   * ```typescript
   * const dbPlugin = plugin('database', '1.0.0')
   *   .onShutdown(async ({ store }) => {
   *     await store.connection?.close();
   *   })
   *   .setup(() => ({}));
   * ```
   */
  onShutdown(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore, TApi>['onShutdown']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Handles errors during plugin initialization.
   *
   * @param hook - Error handler function
   * @returns Plugin builder
   *
   * @example
   * ```typescript
   * const apiPlugin = plugin('api', '1.0.0')
   *   .onError((error, { store }) => {
   *     store.errors.push(error);
   *     console.error('Plugin error:', error);
   *   })
   *   .setup(() => ({}));
   * ```
   */
  onError(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore>['onError']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
}

class PluginBuilderImpl<
  TName extends string,
  TApi = unknown,
  TDeps = Record<string, never>,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
  TStore extends Record<string, any> = Record<string, never>,
> implements PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>
{
  private dependencies: PluginDependency[] = [];
  private extensions: PluginExtension[] = [];
  private proxies: ProxyMetadata[] = [];
  private hooks: PluginLifecycleHooks<TDeps, TStore> = {};
  private pluginMetadata: TMetadata = {} as TMetadata;
  private pluginStore: Store<TStore> = createStore({} as TStore);
  private pluginConfig: { errors?: import('@/errors').ErrorConfig } & Record<string, unknown> = {};

  constructor(
    private readonly name: TName,
    private readonly version: Version
  ) {}

  store<TNewStore extends Record<string, any>>(
    factory: () => TNewStore
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TNewStore> {
    const rawStore = factory();

    this.pluginStore = (isStore(rawStore)
      ? rawStore
      : createStore(rawStore)) as unknown as Store<TStore>;

    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TNewStore>;
  }

  config(
    config: { errors?: import('@/errors').ErrorConfig } & Record<string, unknown>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    this.pluginConfig = { ...this.pluginConfig, ...config };
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
  }

  metadata<TNewMetadata extends Record<string, unknown>>(
    metadata: TNewMetadata
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TNewMetadata, TStore> {
    this.pluginMetadata = metadata as unknown as TMetadata;
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TNewMetadata, TStore>;
  }

  depends<
    TDepName extends string,
    TDepApi,
    TDepExtMap = unknown,
    TDepMetadata = unknown,
    TDepStore extends Record<string, any> = any,
  >(
    plugin: BuiltPlugin<TDepName, TDepApi, TDepExtMap, TDepMetadata, TDepStore>,
    versionRange = '*'
  ): PluginBuilder<
    TName,
    TApi,
    TDeps & Record<TDepName, TDepApi & { __meta__?: TDepMetadata; __store__?: TDepStore }>,
    TExtMap,
    TMetadata,
    TStore
  > {
    this.dependencies.push({
      pluginId: plugin.id,
      versionRange,
    });

    return this as unknown as PluginBuilder<
      TName,
      TApi,
      TDeps & Record<TDepName, TDepApi & { __meta__?: TDepMetadata; __store__?: TDepStore }>,
      TExtMap,
      TMetadata,
      TStore
    >;
  }

  extend<
    TTargetName extends string,
    TTargetApi,
    TTargetExtMap = unknown,
    TTargetMetadata = unknown,
    TTargetStore extends Record<string, any> = any,
    TExt extends object = object,
  >(
    target: BuiltPlugin<TTargetName, TTargetApi, TTargetExtMap, TTargetMetadata, TTargetStore>,
    fn: (api: TTargetApi & Record<string, any>) => TExt
  ): PluginBuilder<TName, TApi, TDeps, TExtMap & Record<TTargetName, TExt>, TMetadata, TStore> {
    this.extensions.push({
      targetPluginId: target.id,
      extensionFn: fn as (api: unknown) => unknown,
    });
    return this as unknown as PluginBuilder<
      TName,
      TApi,
      TDeps,
      TExtMap & Record<TTargetName, TExt>,
      TMetadata,
      TStore
    >;
  }

  proxy(
    targetOrConfig: any,
    configOrUndefined?: any
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    let targetPluginId: ProxyTarget;
    let config: ProxyConfig<TStore>;

    const finalConfig = configOrUndefined === undefined ? targetOrConfig : configOrUndefined;
    validateProxyConfig(finalConfig);

    if (configOrUndefined === undefined) {
      targetPluginId = 'self';
      config = targetOrConfig;
    } else if (targetOrConfig === '*') {
      targetPluginId = '*';
      config = configOrUndefined;
    } else if (targetOrConfig === '**') {
      targetPluginId = '**';
      config = configOrUndefined;
    } else {
      const target = targetOrConfig as BuiltPlugin<string, any, any, any, any>;

      const hasDependency = this.dependencies.some(dep => dep.pluginId === target.id);

      if (!hasDependency) {
        const error = new PluginDependencyError({
          plugin: this.name,
          dependency: target.name,
        });
        error.severity = ErrorSeverity.ERROR;
        error.solutions = [
          solution(
            'Declare the plugin as a dependency',
            `Add .depends(${target.name}Plugin, '^1.0.0') before calling .proxy()`,
            `.depends(${target.name}Plugin, '^1.0.0')\n  .proxy(${target.name}Plugin, { ... })`
          ),
        ];
        throw error;
      }

      targetPluginId = target.id;
      config = configOrUndefined;
    }

    const proxyMetadata: ProxyMetadata = {
      targetPluginId,
      config: config as any,
    };

    this.proxies.push(proxyMetadata);

    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
  }

  onInit(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore>['onInit']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    this.hooks = { ...this.hooks, onInit: hook as any };
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
  }

  onReady(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore, TApi>['onReady']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    this.hooks = { ...this.hooks, onReady: hook as any };
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
  }

  onShutdown(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore, TApi>['onShutdown']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    this.hooks = { ...this.hooks, onShutdown: hook as any };
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
  }

  onError(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore>['onError']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    this.hooks = { ...this.hooks, onError: hook as any };
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
  }

  setup<TNewApi>(
    fn: (ctx: PluginSetupContext<TDeps, TStore>) => TNewApi
  ): BuiltPlugin<TName, TNewApi, TExtMap, TMetadata, TStore> {
    const setupFn = fn as unknown as (
      ctx: PluginSetupContext<Record<string, unknown>, TStore>
    ) => TNewApi;
    const hooks = this.hooks as any;
    return new BuiltPluginImpl(
      this.name,
      this.version,
      setupFn,
      this.dependencies,
      this.extensions,
      this.proxies,
      hooks,
      this.pluginMetadata,
      this.pluginStore,
      this.pluginConfig
    );
  }
}

class BuiltPluginImpl<
  TName extends string,
  TApi,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
  TStore extends Record<string, any> = Record<string, never>,
> implements BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore>
{
  readonly id: PluginId;

  constructor(
    readonly name: TName,
    readonly version: Version,
    readonly setupFn: (ctx: PluginSetupContext<Record<string, unknown>, TStore>) => TApi,
    readonly dependencies: readonly PluginDependency[],
    readonly extensions: readonly PluginExtension[],
    readonly proxies: readonly ProxyMetadata[],
    readonly hooks: PluginLifecycleHooks,
    readonly metadata: TMetadata,
    readonly store: Store<TStore>,
    readonly config: { errors?: import('@/errors').ErrorConfig } & Record<string, unknown>
  ) {
    this.id = createPluginId(name);
  }

  proxy(config: ProxyConfig<TStore>): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore> {
    validateProxyConfig(config);

    const proxyMetadata: ProxyMetadata = {
      targetPluginId: 'self',
      config: config as any,
    };

    return new BuiltPluginImpl<TName, TApi, TExtMap, TMetadata, TStore>(
      this.name,
      this.version,
      this.setupFn,
      this.dependencies,
      this.extensions,
      [...this.proxies, proxyMetadata],
      this.hooks,
      this.metadata,
      this.store,
      this.config
    );
  }

  onInit(
    hook: PluginLifecycleHooks<Record<string, unknown>, TStore, never>['onInit']
  ): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore> {
    return new BuiltPluginImpl<TName, TApi, TExtMap, TMetadata, TStore>(
      this.name,
      this.version,
      this.setupFn,
      this.dependencies,
      this.extensions,
      this.proxies,
      { ...this.hooks, onInit: hook as any },
      this.metadata,
      this.store,
      this.config
    );
  }

  onReady(
    hook: PluginLifecycleHooks<Record<string, unknown>, TStore, TApi>['onReady']
  ): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore> {
    return new BuiltPluginImpl<TName, TApi, TExtMap, TMetadata, TStore>(
      this.name,
      this.version,
      this.setupFn,
      this.dependencies,
      this.extensions,
      this.proxies,
      { ...this.hooks, onReady: hook as any },
      this.metadata,
      this.store,
      this.config
    );
  }

  onShutdown(
    hook: PluginLifecycleHooks<Record<string, unknown>, TStore, TApi>['onShutdown']
  ): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore> {
    return new BuiltPluginImpl<TName, TApi, TExtMap, TMetadata, TStore>(
      this.name,
      this.version,
      this.setupFn,
      this.dependencies,
      this.extensions,
      this.proxies,
      { ...this.hooks, onShutdown: hook as any },
      this.metadata,
      this.store,
      this.config
    );
  }

  onError(
    hook: PluginLifecycleHooks<Record<string, unknown>, TStore, never>['onError']
  ): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore> {
    return new BuiltPluginImpl<TName, TApi, TExtMap, TMetadata, TStore>(
      this.name,
      this.version,
      this.setupFn,
      this.dependencies,
      this.extensions,
      this.proxies,
      { ...this.hooks, onError: hook as any },
      this.metadata,
      this.store,
      this.config
    );
  }
}

/**
 * Creates a new plugin with the specified name and version.
 *
 * @param name - Unique plugin identifier
 * @param version - Semantic version (e.g., "1.0.0")
 * @returns A plugin builder for configuring the plugin
 *
 * @example
 * ```typescript
 * const mathPlugin = plugin('math', '1.0.0')
 *   .setup(() => ({
 *     add: (a: number, b: number) => a + b
 *   }));
 * ```
 */
export function plugin<TName extends string>(
  name: TName,
  version: string
): PluginBuilder<
  TName,
  unknown,
  Record<string, never>,
  Record<string, never>,
  Record<string, unknown>,
  Record<string, never>
> {
  return new PluginBuilderImpl(name, createVersion(version));
}
