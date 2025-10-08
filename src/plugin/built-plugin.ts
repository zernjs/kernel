/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Built plugin implementation
 * @description Immutable representation of a fully configured plugin
 */

import type {
  PluginId,
  Version,
  PluginDependency,
  PluginExtension,
  PluginLifecycleHooks,
} from '@/core';
import { createPluginId } from '@/core';
import type { ProxyMetadata, ProxyConfig } from '@/extension/proxy-types';
import { validateProxyConfig } from '@/extension/proxy-types';
import type { Store } from '@/store';
import type { BuiltPlugin, PluginSetupContext } from './types';

export class BuiltPluginImpl<
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
