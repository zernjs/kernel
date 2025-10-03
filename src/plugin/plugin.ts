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
export interface PluginSetupContext<TDeps = Record<string, never>> {
  readonly plugins: TDeps;
  readonly kernel: KernelContext;
}

// Plugin builted, result of the setup function
export interface BuiltPlugin<
  TName extends string,
  TApi,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
> {
  readonly id: PluginId;
  readonly name: TName;
  readonly version: Version;
  readonly dependencies: readonly PluginDependency[];
  readonly extensions: readonly PluginExtension[];
  readonly proxies: readonly ProxyMetadata[];
  readonly hooks: PluginLifecycleHooks;
  readonly metadata: TMetadata;
  readonly setupFn: (ctx: PluginSetupContext<Record<string, unknown>>) => TApi;
  // Phantom type to carry compile-time extension info
  readonly __extensions__?: TExtMap | undefined;

  // Self-proxy method (only self-proxy is allowed on BuiltPlugin)
  proxy(config: ProxyConfig<TApi>): BuiltPlugin<TName, TApi, TExtMap, TMetadata>;
}

// Plugin builder
export interface PluginBuilder<
  TName extends string,
  TApi = unknown,
  TDeps = Record<string, never>,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
> {
  metadata<TNewMetadata extends Record<string, unknown>>(
    metadata: TNewMetadata
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TNewMetadata>;

  setup<TNewApi>(
    fn: (ctx: PluginSetupContext<TDeps>) => TNewApi
  ): BuiltPlugin<TName, TNewApi, TExtMap, TMetadata>;

  depends<TDepName extends string, TDepApi, TDepExtMap = unknown, TDepMetadata = unknown>(
    plugin: BuiltPlugin<TDepName, TDepApi, TDepExtMap, TDepMetadata>,
    versionRange?: string
  ): PluginBuilder<
    TName,
    TApi,
    TDeps & Record<TDepName, TDepApi & { __meta__?: TDepMetadata }>,
    TExtMap,
    TMetadata
  >;

  extend<TTargetName extends string, TTargetApi, TExt extends object>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    fn: (api: TTargetApi) => TExt
  ): PluginBuilder<TName, TApi, TDeps, TExtMap & Record<TTargetName, TExt>, TMetadata>;

  // Unified proxy method for method interception
  // Use factory function for automatic type inference: ctx => ({ before: () => {...} })
  // Or use object directly: { before: ctx => {...} }

  // 1. Self-proxy: proxy own methods
  proxy(config: ProxyConfig<TApi>): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;

  // 2. Single plugin proxy: proxy specific plugin (must be in dependencies)
  proxy<TTargetName extends string, TTargetApi>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown, unknown>,
    config: ProxyConfig<TTargetApi>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;

  // 3. Dependencies proxy: proxy all plugins in dependencies
  proxy(
    target: '*',
    config: ProxyConfig<any>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;

  // 4. Global proxy: proxy all plugins in kernel
  proxy(
    target: '**',
    config: ProxyConfig<any>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;

  // Lifecycle hooks - typed with dependencies + metadata
  onInit(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>>['onInit']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;
  onReady(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>>['onReady']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;
  onShutdown(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>>['onShutdown']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;
  onError(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>>['onError']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;
}

// Builder plugin implementation
class PluginBuilderImpl<
  TName extends string,
  TApi = unknown,
  TDeps = Record<string, never>,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
> implements PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>
{
  private dependencies: PluginDependency[] = [];
  private extensions: PluginExtension[] = [];
  private proxies: ProxyMetadata[] = [];
  private hooks: PluginLifecycleHooks<TDeps> = {};
  private pluginMetadata: TMetadata = {} as TMetadata;

  constructor(
    private readonly name: TName,
    private readonly version: Version
  ) {}

  metadata<TNewMetadata extends Record<string, unknown>>(
    metadata: TNewMetadata
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TNewMetadata> {
    this.pluginMetadata = metadata as unknown as TMetadata;
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TNewMetadata>;
  }

  depends<TDepName extends string, TDepApi, TDepExtMap = unknown, TDepMetadata = unknown>(
    plugin: BuiltPlugin<TDepName, TDepApi, TDepExtMap, TDepMetadata>,
    versionRange = '*'
  ): PluginBuilder<
    TName,
    TApi,
    TDeps & Record<TDepName, TDepApi & { __meta__?: TDepMetadata }>,
    TExtMap,
    TMetadata
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
      TMetadata
    >;
  }

  extend<TTargetName extends string, TTargetApi, TExt extends object>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    fn: (api: TTargetApi) => TExt
  ): PluginBuilder<TName, TApi, TDeps, TExtMap & Record<TTargetName, TExt>, TMetadata> {
    this.extensions.push({
      targetPluginId: target.id,
      extensionFn: fn as (api: unknown) => unknown,
    });
    return this as unknown as PluginBuilder<
      TName,
      TApi,
      TDeps,
      TExtMap & Record<TTargetName, TExt>,
      TMetadata
    >;
  }

  // Unified proxy method for method interception
  proxy(
    targetOrConfig: any,
    configOrUndefined?: any
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata> {
    let targetPluginId: ProxyTarget;
    let config: ProxyConfig<any>;

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
      const target = targetOrConfig as BuiltPlugin<string, unknown, unknown, unknown>;

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

    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;
  }

  // Lifecycle hooks
  onInit(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>>['onInit']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata> {
    this.hooks = { ...this.hooks, onInit: hook as any };
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;
  }

  onReady(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>>['onReady']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata> {
    this.hooks = { ...this.hooks, onReady: hook as any };
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;
  }

  onShutdown(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>>['onShutdown']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata> {
    this.hooks = { ...this.hooks, onShutdown: hook as any };
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;
  }

  onError(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>>['onError']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata> {
    this.hooks = { ...this.hooks, onError: hook as any };
    return this as unknown as PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata>;
  }

  setup<TNewApi>(
    fn: (ctx: PluginSetupContext<TDeps>) => TNewApi
  ): BuiltPlugin<TName, TNewApi, TExtMap, TMetadata> {
    const setupFn = fn as unknown as (ctx: PluginSetupContext<Record<string, unknown>>) => TNewApi;
    // Cast hooks to the expected type - runtime will provide correct types
    const hooks = this.hooks as unknown as PluginLifecycleHooks<Record<string, unknown>>;
    return new BuiltPluginImpl(
      this.name,
      this.version,
      setupFn,
      this.dependencies,
      this.extensions,
      this.proxies,
      hooks,
      this.pluginMetadata
    );
  }
}

// Built plugin implementation
class BuiltPluginImpl<
  TName extends string,
  TApi,
  TExtMap = Record<string, never>,
  TMetadata = Record<string, unknown>,
> implements BuiltPlugin<TName, TApi, TExtMap, TMetadata>
{
  readonly id: PluginId;

  constructor(
    readonly name: TName,
    readonly version: Version,
    readonly setupFn: (ctx: PluginSetupContext<Record<string, unknown>>) => TApi,
    readonly dependencies: readonly PluginDependency[],
    readonly extensions: readonly PluginExtension[],
    readonly proxies: readonly ProxyMetadata[],
    readonly hooks: PluginLifecycleHooks,
    readonly metadata: TMetadata
  ) {
    this.id = createPluginId(name);
  }

  // Self-proxy method for BuiltPlugin
  proxy(config: ProxyConfig<TApi>): BuiltPlugin<TName, TApi, TExtMap, TMetadata> {
    const proxyMetadata: ProxyMetadata = {
      targetPluginId: 'self',
      config: config as any,
    };

    return new BuiltPluginImpl<TName, TApi, TExtMap, TMetadata>(
      this.name,
      this.version,
      this.setupFn,
      this.dependencies,
      this.extensions,
      [...this.proxies, proxyMetadata], // Add new proxy
      this.hooks,
      this.metadata
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
  Record<string, unknown>
> {
  return new PluginBuilderImpl(name, createVersion(version));
}
