/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Extension system for modified plugin APIs
 * @description Allows plugins to extend other plugins' APIs and intercept methods via proxies
 */

import type { PluginId, PluginExtension } from '@/core';
import { createPluginId } from '@/core';
import type { ProxyMetadata, CompiledMethodProxy } from './proxy-types';
import { shouldProxyMethod, enhanceContext } from './proxy-types';

export interface RuntimeErrorHandler {
  (error: Error, context: { pluginName: string; method: string }): Promise<void> | void;
}

export interface PluginInfo {
  api: unknown;
  store: unknown;
  metadata: {
    name: string;
    version: string;
    [key: string]: unknown;
  };
}

export interface ProxySourceInfo {
  store: unknown;
}

export interface ExtensionManager {
  registerExtension(extension: PluginExtension): void;
  registerProxy(proxy: ProxyMetadata): void;
  applyExtensions<TApi extends object>(
    pluginName: string,
    baseApi: TApi,
    store?: unknown,
    metadata?: unknown,
    pluginInfos?: Record<string, PluginInfo>,
    proxySourceInfos?: Record<string, ProxySourceInfo>,
    onRuntimeError?: RuntimeErrorHandler
  ): TApi;
  getExtensions(pluginName: string): readonly PluginExtension[];
  getProxies(pluginName: string): readonly ProxyMetadata[];
  clear(): void;
}

class ExtensionManagerImpl implements ExtensionManager {
  private extensions = new Map<PluginId, PluginExtension[]>();
  private proxies = new Map<PluginId, ProxyMetadata[]>();

  registerExtension(extension: PluginExtension): void {
    const targetName = extension.targetPluginId;
    const existing = this.extensions.get(targetName) ?? [];
    this.extensions.set(targetName, [...existing, extension]);
  }

  registerProxy(proxy: ProxyMetadata): void {
    const targetName = proxy.targetPluginId as PluginId;
    const existing = this.proxies.get(targetName) ?? [];
    this.proxies.set(targetName, [...existing, proxy]);
  }

  applyExtensions<TApi extends object>(
    pluginName: string,
    baseApi: TApi,
    store: unknown = {},
    metadata: unknown = {},
    pluginInfos: Record<string, PluginInfo> = {},
    proxySourceInfos: Record<string, ProxySourceInfo> = {},
    onRuntimeError?: RuntimeErrorHandler
  ): TApi {
    const extensions = this.extensions.get(createPluginId(pluginName)) ?? [];
    const proxies = this.proxies.get(createPluginId(pluginName)) ?? [];

    if (extensions.length === 0 && proxies.length === 0) {
      return baseApi;
    }

    let extendedApi: TApi = { ...baseApi };

    for (const extension of extensions) {
      try {
        const extensionResult = extension.extensionFn(extendedApi);
        if (isObject(extensionResult)) {
          extendedApi = {
            ...(extendedApi as unknown as Record<string, unknown>),
            ...extensionResult,
          } as unknown as TApi;
        } else {
          console.warn(`Extension for ${pluginName} returned a non-object; skipping.`);
        }
      } catch (error) {
        console.warn(`Failed to apply extension to ${pluginName}:`, error);
      }
    }

    if (proxies.length > 0) {
      const pluginsWithAccessors: Record<string, unknown> = {};

      for (const [name, info] of Object.entries(pluginInfos)) {
        pluginsWithAccessors[name] = {
          ...(typeof info.api === 'object' && info.api !== null ? info.api : {}),
          $store: info.store,
          $meta: info.metadata,
        };
      }

      pluginsWithAccessors[pluginName] = {
        ...(typeof extendedApi === 'object' && extendedApi !== null ? extendedApi : {}),
        $store: store,
        $meta: metadata,
      };

      extendedApi = this.applyProxies(
        pluginName,
        extendedApi,
        proxies,
        store,
        pluginsWithAccessors,
        proxySourceInfos,
        onRuntimeError
      );
    }

    return extendedApi;
  }

  private applyProxies<TApi extends object>(
    pluginName: string,
    api: TApi,
    proxies: readonly ProxyMetadata[],
    store: unknown,
    plugins: Record<string, unknown>,
    proxySourceInfos: Record<string, ProxySourceInfo>,
    onRuntimeError?: RuntimeErrorHandler
  ): TApi {
    const proxiedApi = { ...api } as Record<string, unknown>;
    const compiledProxies = this.compileProxies(api, proxies);
    const proxiesByMethod = new Map<string, CompiledMethodProxy[]>();

    for (const proxy of compiledProxies) {
      const existing = proxiesByMethod.get(proxy.methodName) ?? [];
      proxiesByMethod.set(proxy.methodName, [...existing, proxy]);
    }

    for (const [, methodProxies] of proxiesByMethod) {
      methodProxies.sort((a, b) => b.priority - a.priority);
    }

    for (const [methodName, methodProxies] of proxiesByMethod) {
      const originalMethod = proxiedApi[methodName];

      if (typeof originalMethod === 'function') {
        proxiedApi[methodName] = this.createProxiedMethod(
          pluginName,
          methodName,
          originalMethod as (...args: unknown[]) => unknown,
          methodProxies,
          store,
          plugins,
          proxySourceInfos,
          onRuntimeError
        );
      }
    }

    return proxiedApi as TApi;
  }

  private compileProxies<TApi extends object>(
    api: TApi,
    proxies: readonly ProxyMetadata[]
  ): CompiledMethodProxy[] {
    const compiled: CompiledMethodProxy[] = [];

    for (const proxyMeta of proxies) {
      const config = proxyMeta.config;

      const allMethodNames = Object.keys(api).filter(
        key => typeof (api as any)[key] === 'function'
      );

      const targetMethods = allMethodNames.filter(methodName =>
        shouldProxyMethod(methodName, {
          include: config.include,
          exclude: config.exclude,
        })
      );

      for (const methodName of targetMethods) {
        compiled.push({
          targetPluginId: proxyMeta.targetPluginId as PluginId,
          sourcePluginId: proxyMeta.sourcePluginId,
          methodName,
          before: config.before,
          after: config.after,
          onError: config.onError,
          around: config.around,
          priority: config.priority ?? 50,
          condition: config.condition,
          group: config.group,
        });
      }
    }

    return compiled;
  }

  private createProxiedMethod(
    pluginName: string,
    methodName: string,
    originalMethod: (...args: unknown[]) => unknown,
    proxies: readonly CompiledMethodProxy[],
    store: unknown,
    plugins: Record<string, unknown>,
    proxySourceInfos: Record<string, ProxySourceInfo>,
    onRuntimeError?: RuntimeErrorHandler
  ): (...args: unknown[]) => unknown {
    return async (...args: unknown[]) => {
      let currentArgs = args;
      let skipExecution = false;
      let overrideResult: unknown;

      try {
        for (const proxy of proxies) {
          const proxyStore = proxy.sourcePluginId
            ? (proxySourceInfos[proxy.sourcePluginId]?.store ?? {})
            : store;

          const ctx = enhanceContext({
            pluginName,
            plugins,
            method: methodName,
            args: currentArgs,
            store: proxyStore,
          } as any);

          if (proxy.condition && !proxy.condition(ctx)) {
            continue;
          }

          if (proxy.before) {
            await proxy.before(ctx);

            if (ctx._skipExecution) {
              skipExecution = true;
              overrideResult = ctx._overrideResult;
              break;
            }

            if (ctx._modifiedArgs) {
              currentArgs = ctx._modifiedArgs;
            }
          }
        }

        let result: unknown;

        if (skipExecution) {
          result = overrideResult;
        } else {
          const aroundProxy = proxies.find(p => p.around);

          if (aroundProxy) {
            const proxyStore = aroundProxy.sourcePluginId
              ? (proxySourceInfos[aroundProxy.sourcePluginId]?.store ?? {})
              : store;

            const ctx = enhanceContext({
              pluginName,
              plugins,
              method: methodName,
              args: currentArgs,
              store: proxyStore,
            } as any);

            result = await aroundProxy.around!(ctx, async () => {
              return await originalMethod(...currentArgs);
            });
          } else {
            result = await originalMethod(...currentArgs);
          }
        }

        for (const proxy of proxies) {
          const proxyStore = proxy.sourcePluginId
            ? (proxySourceInfos[proxy.sourcePluginId]?.store ?? {})
            : store;

          const ctx = enhanceContext({
            pluginName,
            plugins,
            method: methodName,
            args: currentArgs,
            store: proxyStore,
          } as any);

          if (proxy.condition && !proxy.condition(ctx)) {
            continue;
          }

          if (proxy.after) {
            result = await proxy.after(result, ctx);
          }
        }

        return result;
      } catch (error) {
        for (const proxy of proxies) {
          const proxyStore = proxy.sourcePluginId
            ? (proxySourceInfos[proxy.sourcePluginId]?.store ?? {})
            : store;

          const ctx = enhanceContext({
            pluginName,
            plugins,
            method: methodName,
            args: currentArgs,
            store: proxyStore,
          } as any);

          if (proxy.condition && !proxy.condition(ctx)) {
            continue;
          }

          if (proxy.onError) {
            return await proxy.onError(error as Error, ctx);
          }
        }

        if (onRuntimeError) {
          await onRuntimeError(error as Error, {
            pluginName,
            method: methodName,
          });
        }

        throw error;
      }
    };
  }

  getExtensions(pluginName: string): readonly PluginExtension[] {
    return this.extensions.get(createPluginId(pluginName)) ?? [];
  }

  getProxies(pluginName: string): readonly ProxyMetadata[] {
    return this.proxies.get(createPluginId(pluginName)) ?? [];
  }

  clear(): void {
    this.extensions.clear();
    this.proxies.clear();
  }
}

export function createExtensionManager(): ExtensionManager {
  return new ExtensionManagerImpl();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
