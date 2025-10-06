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

export interface ExtensionManager {
  registerExtension(extension: PluginExtension): void;
  registerProxy(proxy: ProxyMetadata): void;
  applyExtensions<TApi extends object>(
    pluginName: string,
    baseApi: TApi,
    store?: unknown,
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
      extendedApi = this.applyProxies(pluginName, extendedApi, proxies, store, onRuntimeError);
    }

    return extendedApi;
  }

  private applyProxies<TApi extends object>(
    pluginName: string,
    api: TApi,
    proxies: readonly ProxyMetadata[],
    store: unknown,
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
    onRuntimeError?: RuntimeErrorHandler
  ): (...args: unknown[]) => unknown {
    return async (...args: unknown[]) => {
      const baseContext = {
        plugin: pluginName,
        method: methodName,
        args,
        store,
      };

      const enhancedContext = enhanceContext(baseContext as any);

      try {
        for (const proxy of proxies) {
          if (proxy.condition && !proxy.condition(enhancedContext)) {
            continue;
          }

          if (proxy.before) {
            await proxy.before(enhancedContext);

            if (enhancedContext._skipExecution) {
              return enhancedContext._overrideResult;
            }
          }
        }

        const finalArgs = enhancedContext._modifiedArgs ?? enhancedContext.args;
        const aroundProxy = proxies.find(
          p => p.around && (!p.condition || p.condition(enhancedContext))
        );

        let result: unknown;

        if (aroundProxy) {
          result = await aroundProxy.around!(enhancedContext, async () => {
            return await originalMethod(...finalArgs);
          });
        } else {
          result = await originalMethod(...finalArgs);
        }

        for (const proxy of proxies) {
          if (proxy.condition && !proxy.condition(enhancedContext)) {
            continue;
          }

          if (proxy.after) {
            result = await proxy.after(result, enhancedContext);
          }
        }

        return result;
      } catch (error) {
        for (const proxy of proxies) {
          if (proxy.condition && !proxy.condition(enhancedContext)) {
            continue;
          }

          if (proxy.onError) {
            return await proxy.onError(error as Error, enhancedContext);
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
