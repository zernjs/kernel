/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Plugin builder implementation
 * @description Implements the fluent plugin builder API
 */

import type { Version, PluginDependency, PluginExtension, PluginLifecycleHooks } from '@/core';
import type { ProxyMetadata, ProxyTarget, ProxyConfig } from '@/extension/proxy-types';
import { validateProxyConfig } from '@/extension/proxy-types';
import { createStore, isStore } from '@/store';
import type { Store } from '@/store';
import { PluginDependencyError, ErrorSeverity, solution } from '@/errors';
import type { DepsWithMetadata } from '@/utils/types';
import type { PluginBuilder, BuiltPlugin, PluginSetupContext } from './types';
import { BuiltPluginImpl } from './built-plugin';

export class PluginBuilderImpl<
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
    return this;
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

    return this;
  }

  onInit(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore>['onInit']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    this.hooks = { ...this.hooks, onInit: hook as any };
    return this;
  }

  onReady(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore, TApi>['onReady']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    this.hooks = { ...this.hooks, onReady: hook as any };
    return this;
  }

  onShutdown(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore, TApi>['onShutdown']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    this.hooks = { ...this.hooks, onShutdown: hook as any };
    return this;
  }

  onError(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore>['onError']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
    this.hooks = { ...this.hooks, onError: hook as any };
    return this;
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
