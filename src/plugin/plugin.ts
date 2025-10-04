/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Plugin system with builder pattern for the Zern Kernel
 * @description Provides an fluent type-safe API for plugin creation and management
 */

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
import type { ProxyConfig, ProxyMetadata, ProxyTarget } from '@/extension/proxy-types';

// Context available in plugin setup function
export interface PluginSetupContext<TDeps = Record<string, never>, TStore = Record<string, never>> {
  readonly plugins: TDeps;
  readonly kernel: KernelContext;
  readonly store: TStore;
}

// Plugin builted, result of the setup function
export interface BuiltPlugin<
  TName extends string,
  TApi,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
  TStore = Record<string, never>,
> {
  readonly id: PluginId;
  readonly name: TName;
  readonly version: Version;
  readonly dependencies: readonly PluginDependency[];
  readonly extensions: readonly PluginExtension[];
  readonly proxies: readonly ProxyMetadata[];
  readonly hooks: PluginLifecycleHooks;
  readonly metadata: TMetadata;
  readonly store: TStore;
  readonly setupFn: (ctx: PluginSetupContext<Record<string, unknown>, TStore>) => TApi;
  // Phantom type to carry compile-time extension info
  readonly __extensions__?: TExtMap | undefined;

  // Self-proxy method (only self-proxy is allowed on BuiltPlugin)
  proxy(config: ProxyConfig<TStore>): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore>;

  // Lifecycle hooks can be added after setup (with access to TApi type)
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

// Plugin builder
export interface PluginBuilder<
  TName extends string,
  TApi = unknown,
  TDeps = Record<string, never>,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
  TStore = Record<string, never>,
> {
  // Define shared store with automatic type inference
  store<TNewStore>(
    factory: () => TNewStore
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TNewStore>;

  metadata<TNewMetadata extends Record<string, unknown>>(
    metadata: TNewMetadata
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TNewMetadata, TStore>;

  setup<TNewApi>(
    fn: (ctx: PluginSetupContext<TDeps, TStore>) => TNewApi
  ): BuiltPlugin<TName, TNewApi, TExtMap, TMetadata, TStore>;

  depends<
    TDepName extends string,
    TDepApi,
    TDepExtMap = unknown,
    TDepMetadata = unknown,
    TDepStore = any,
  >(
    plugin: BuiltPlugin<TDepName, TDepApi, TDepExtMap, TDepMetadata, TDepStore>,
    versionRange?: string
  ): PluginBuilder<
    TName,
    TApi,
    TDeps & Record<TDepName, TDepApi & { __meta__?: TDepMetadata }>,
    TExtMap,
    TMetadata,
    TStore
  >;

  extend<
    TTargetName extends string,
    TTargetApi,
    TTargetExtMap = unknown,
    TTargetMetadata = unknown,
    TTargetStore = any,
    TExt extends object = object,
  >(
    target: BuiltPlugin<TTargetName, TTargetApi, TTargetExtMap, TTargetMetadata, TTargetStore>,
    fn: (api: TTargetApi) => TExt
  ): PluginBuilder<TName, TApi, TDeps, TExtMap & Record<TTargetName, TExt>, TMetadata, TStore>;

  // Unified proxy method for method interception
  // Store is automatically injected into proxy context

  // 1. Self-proxy: proxy own methods
  proxy(config: ProxyConfig<TStore>): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  // 2. Single plugin proxy: proxy specific plugin (must be in dependencies)
  proxy<
    TTargetName extends string,
    TTargetApi,
    TTargetExtMap = unknown,
    TTargetMetadata = unknown,
    TTargetStore = any,
  >(
    target: BuiltPlugin<TTargetName, TTargetApi, TTargetExtMap, TTargetMetadata, TTargetStore>,
    config: ProxyConfig<TStore>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  // 3. Dependencies proxy: proxy all plugins in dependencies
  proxy(
    target: '*',
    config: ProxyConfig<TStore>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  // 4. Global proxy: proxy all plugins in kernel
  proxy(
    target: '**',
    config: ProxyConfig<TStore>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  // Lifecycle hooks - typed with dependencies + metadata + store + api (for onReady/onShutdown)
  onInit(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore>['onInit']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
  onReady(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore, TApi>['onReady']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
  onShutdown(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore, TApi>['onShutdown']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
  onError(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore>['onError']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
}

// Builder plugin implementation
class PluginBuilderImpl<
  TName extends string,
  TApi = unknown,
  TDeps = Record<string, never>,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
  TStore = Record<string, never>,
> implements PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>
{
  private dependencies: PluginDependency[] = [];
  private extensions: PluginExtension[] = [];
  private proxies: ProxyMetadata[] = [];
  private hooks: PluginLifecycleHooks<TDeps, TStore> = {};
  private pluginMetadata: TMetadata = {} as TMetadata;
  private pluginStore: TStore = {} as TStore;

  constructor(
    private readonly name: TName,
    private readonly version: Version
  ) {}

  store<TNewStore>(
    factory: () => TNewStore
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TNewStore> {
    this.pluginStore = factory() as unknown as TStore;
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TNewStore>;
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
    TDepStore = any,
  >(
    plugin: BuiltPlugin<TDepName, TDepApi, TDepExtMap, TDepMetadata, TDepStore>,
    versionRange = '*'
  ): PluginBuilder<
    TName,
    TApi,
    TDeps & Record<TDepName, TDepApi & { __meta__?: TDepMetadata }>,
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
      TDeps & Record<TDepName, TDepApi & { __meta__?: TDepMetadata }>,
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
    TTargetStore = any,
    TExt extends object = object,
  >(
    target: BuiltPlugin<TTargetName, TTargetApi, TTargetExtMap, TTargetMetadata, TTargetStore>,
    fn: (api: TTargetApi) => TExt
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

  // Unified proxy method for method interception
  proxy(
    targetOrConfig: any,
    configOrUndefined?: any
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    let targetPluginId: ProxyTarget;
    let config: ProxyConfig<TStore>;

    // Detect which overload was called
    if (configOrUndefined === undefined) {
      // Case 1: Self-proxy - .proxy({ ... })
      targetPluginId = 'self';
      config = targetOrConfig;
    } else if (targetOrConfig === '*') {
      // Case 3: Dependencies proxy - .proxy('*', { ... })
      targetPluginId = '*';
      config = configOrUndefined;
    } else if (targetOrConfig === '**') {
      // Case 4: Global proxy - .proxy('**', { ... })
      targetPluginId = '**';
      config = configOrUndefined;
    } else {
      // Case 2: Single plugin proxy - .proxy(plugin, { ... })
      const target = targetOrConfig as BuiltPlugin<string, unknown, unknown, unknown, unknown>;

      // ✅ Validate that target is in dependencies
      const hasDependency = this.dependencies.some(dep => dep.pluginId === target.id);

      if (!hasDependency) {
        throw new Error(
          `Cannot proxy plugin '${target.name}' without declaring it as a dependency. ` +
            `Use .depends(${target.name}Plugin, '...') before .proxy(${target.name}Plugin, ...)`
        );
      }

      targetPluginId = target.id;
      config = configOrUndefined;
    }

    // Store proxy metadata
    const proxyMetadata: ProxyMetadata = {
      targetPluginId,
      config: config as any,
    };

    this.proxies.push(proxyMetadata);

    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
  }

  // Lifecycle hooks
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
    // Hooks stored as any for flexibility - properly typed at runtime
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
      this.pluginStore
    );
  }
}

// Built plugin implementation
class BuiltPluginImpl<
  TName extends string,
  TApi,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
  TStore = Record<string, never>,
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
    readonly store: TStore
  ) {
    this.id = createPluginId(name);
  }

  // Self-proxy method for BuiltPlugin
  proxy(config: ProxyConfig<TStore>): BuiltPlugin<TName, TApi, TExtMap, TMetadata, TStore> {
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
      [...this.proxies, proxyMetadata], // Add new proxy
      this.hooks,
      this.metadata,
      this.store
    );
  }

  // Lifecycle hooks for BuiltPlugin (after setup)
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
      this.store
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
      this.store
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
      this.store
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
      this.store
    );
  }
}

// Factory function for plugin builder
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
