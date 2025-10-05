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
import type { ProxyConfig, ProxyMetadata, ProxyTarget } from '@/extension/proxy-types';
import { createStore, isStore } from '@/store';
import type { Store } from '@/store';

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
  store<TNewStore extends Record<string, any>>(
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
    TDepStore extends Record<string, any> = any,
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
    TTargetStore extends Record<string, any> = any,
    TExt extends object = object,
  >(
    target: BuiltPlugin<TTargetName, TTargetApi, TTargetExtMap, TTargetMetadata, TTargetStore>,
    fn: (api: TTargetApi) => TExt
  ): PluginBuilder<TName, TApi, TDeps, TExtMap & Record<TTargetName, TExt>, TMetadata, TStore>;

  proxy(config: ProxyConfig<TStore>): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  proxy<
    TTargetName extends string,
    TTargetApi,
    TTargetExtMap = unknown,
    TTargetMetadata = unknown,
    TTargetStore extends Record<string, any> = any,
  >(
    target: BuiltPlugin<TTargetName, TTargetApi, TTargetExtMap, TTargetMetadata, TTargetStore>,
    config: ProxyConfig<TStore>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  proxy(
    target: '*',
    config: ProxyConfig<TStore>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  proxy(
    target: '**',
    config: ProxyConfig<TStore>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

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
    TTargetStore extends Record<string, any> = any,
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

  proxy(
    targetOrConfig: any,
    configOrUndefined?: any
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    let targetPluginId: ProxyTarget;
    let config: ProxyConfig<TStore>;

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
        throw new Error(
          `Cannot proxy plugin '${target.name}' without declaring it as a dependency. ` +
            `Use .depends(${target.name}Plugin, '...') before .proxy(${target.name}Plugin, ...)`
        );
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
      this.pluginStore
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
    readonly store: Store<TStore>
  ) {
    this.id = createPluginId(name);
  }

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
      [...this.proxies, proxyMetadata],
      this.hooks,
      this.metadata,
      this.store
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
