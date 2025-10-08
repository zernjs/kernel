/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Plugin type definitions
 * @description Core interfaces and types for the plugin system
 */

import type {
  PluginId,
  Version,
  PluginDependency,
  PluginExtension,
  PluginLifecycleHooks,
} from '@/core';
import type { Store } from '@/store';
import type {
  ProxyConfig,
  ProxyMetadata,
  ProxyDependenciesWildcard,
  ProxyGlobalWildcard,
  ProxyPluginAccess,
  ProxyPluginsMap,
} from '@/extension/proxy-types';
import type { DepsWithMetadata } from '@/utils/types';

/**
 * Context provided to plugin setup function
 */
export interface PluginSetupContext<
  TDeps = Record<string, never>,
  TStore extends Record<string, any> = Record<string, never>,
> {
  readonly plugins: TDeps;
  readonly kernel: import('@/core').KernelContext;
  readonly store: Store<TStore>;
}

/**
 * Represents a fully built plugin ready for registration
 */
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

/**
 * Builder interface for configuring plugins before finalization
 */
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
   */
  store<TNewStore extends Record<string, any>>(
    factory: () => TNewStore
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TNewStore>;

  /**
   * Configures plugin-specific settings including error handling.
   */
  config(
    config: { errors?: import('@/errors').ErrorConfig } & Record<string, unknown>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Attaches custom metadata to the plugin.
   */
  metadata<TNewMetadata extends Record<string, unknown>>(
    metadata: TNewMetadata
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TNewMetadata, TStore>;

  /**
   * Defines the plugin's public API.
   */
  setup<TNewApi>(
    fn: (ctx: PluginSetupContext<TDeps, TStore>) => TNewApi
  ): BuiltPlugin<TName, TNewApi, TExtMap, TMetadata, TStore>;

  /**
   * Declares a dependency on another plugin with optional version constraint.
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
   */
  proxy(
    config: ProxyConfig<TStore, Record<TName, ProxyPluginAccess<TApi, TStore, TMetadata>>>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Intercepts calls to a specific dependency plugin's methods.
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
   */
  proxy<TDepsRecord extends Record<string, any> = TDeps & Record<string, any>>(
    target: ProxyDependenciesWildcard,
    config: ProxyConfig<TStore, ProxyPluginsMap<TDepsRecord>>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Intercepts calls to ALL plugins in the kernel (global proxy).
   */
  proxy(
    target: ProxyGlobalWildcard,
    config: ProxyConfig<TStore, any>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Executes before the plugin's API is created.
   */
  onInit(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore>['onInit']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Executes after all plugins are initialized and ready.
   */
  onReady(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore, TApi>['onReady']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Executes when the kernel shuts down.
   */
  onShutdown(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore, TApi>['onShutdown']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;

  /**
   * Handles errors during plugin initialization.
   */
  onError(
    hook: PluginLifecycleHooks<DepsWithMetadata<TDeps>, TStore>['onError']
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
}
