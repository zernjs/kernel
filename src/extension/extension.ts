/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Extension system for modified plugin APIs
 * @description Allows plugins to extend other plugins' APIs and intercept methods via proxies
 */

import type { PluginId, PluginExtension } from '@/core';
import { createPluginId } from '@/core';
import type { ProxyMetadata, CompiledMethodProxy, ProxyContext } from './proxy-types';
import { shouldProxyMethod, enhanceContext } from './proxy-types';

export interface ExtensionManager {
  registerExtension(extension: PluginExtension): void;
  registerProxy(proxy: ProxyMetadata): void;
  applyExtensions<TApi extends object>(pluginName: string, baseApi: TApi): TApi;
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

  // Register proxy
  registerProxy(proxy: ProxyMetadata): void {
    // After expansion in lifecycle, targetPluginId is always a concrete PluginId
    const targetName = proxy.targetPluginId as PluginId;
    const existing = this.proxies.get(targetName) ?? [];
    this.proxies.set(targetName, [...existing, proxy]);
  }

  applyExtensions<TApi extends object>(pluginName: string, baseApi: TApi): TApi {
    const extensions = this.extensions.get(createPluginId(pluginName)) ?? [];
    const proxies = this.proxies.get(createPluginId(pluginName)) ?? [];

    if (extensions.length === 0 && proxies.length === 0) {
      return baseApi;
    }

    let extendedApi: TApi = { ...baseApi };

    // Apply traditional extensions first
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

    // Apply proxies
    if (proxies.length > 0) {
      extendedApi = this.applyProxies(pluginName, extendedApi, proxies);
    }

    return extendedApi;
  }

  // Apply proxies to a plugin API
  private applyProxies<TApi extends object>(
    pluginName: string,
    api: TApi,
    proxies: readonly ProxyMetadata[]
  ): TApi {
    const proxiedApi = { ...api } as Record<string, unknown>;

    // Compile proxies into method-specific proxies
    const compiledProxies = this.compileProxies(api, proxies);

    // Group by method and sort by priority
    const proxiesByMethod = new Map<string, CompiledMethodProxy[]>();
    for (const proxy of compiledProxies) {
      const existing = proxiesByMethod.get(proxy.methodName) ?? [];
      proxiesByMethod.set(proxy.methodName, [...existing, proxy]);
    }

    // Sort each group by priority (higher first)
    for (const [methodName, methodProxies] of proxiesByMethod) {
      methodProxies.sort((a, b) => b.priority - a.priority);
    }

    // Apply proxies to each method
    for (const [methodName, methodProxies] of proxiesByMethod) {
      const originalMethod = proxiedApi[methodName];

      if (typeof originalMethod === 'function') {
        proxiedApi[methodName] = this.createProxiedMethod(
          pluginName,
          methodName,
          originalMethod as (...args: unknown[]) => unknown,
          methodProxies
        );
      }
    }

    return proxiedApi as TApi;
  }

  // Compile proxy metadata into method-specific compiled proxies
  private compileProxies<TApi extends object>(
    api: TApi,
    proxies: readonly ProxyMetadata[]
  ): CompiledMethodProxy[] {
    const compiled: CompiledMethodProxy[] = [];

    for (const proxyMeta of proxies) {
      // Resolve config (can be function or object)
      const config =
        typeof proxyMeta.config === 'function'
          ? proxyMeta.config({} as any) // Factory function - will be called per-method with real context
          : proxyMeta.config;

      // Get all method names from the API
      const allMethodNames = Object.keys(api).filter(
        key => typeof (api as any)[key] === 'function'
      );

      // Determine which methods should be proxied
      const targetMethods = allMethodNames.filter(methodName =>
        shouldProxyMethod(methodName, {
          methods: config.methods as any,
          include: config.include,
          exclude: config.exclude,
        })
      );

      // Create compiled proxy for each target method
      for (const methodName of targetMethods) {
        compiled.push({
          targetPluginId: proxyMeta.targetPluginId as PluginId, // After expansion, always PluginId
          methodName,
          before: config.before,
          after: config.after,
          onError: config.onError,
          around: config.around,
          priority: config.priority ?? 50,
          condition: config.condition,
          group: config.group,
          // Store original config for later resolution
          configFactory: typeof proxyMeta.config === 'function' ? proxyMeta.config : undefined,
        });
      }
    }

    return compiled;
  }

  // Create proxied method with all interceptors
  private createProxiedMethod(
    pluginName: string,
    methodName: string,
    originalMethod: (...args: unknown[]) => unknown,
    proxies: readonly CompiledMethodProxy[]
  ): (...args: unknown[]) => unknown {
    // Always use async version for proxies (simpler and more flexible)
    return async (...args: unknown[]) => {
      // Create proxy context (partial - will be enhanced with methods)
      const baseContext = {
        plugin: pluginName,
        method: methodName,
        args,
        data: {} as any,
      };

      // Enhance context with helper methods
      const enhancedContext = enhanceContext(baseContext as any);

      // Resolve config factories (if any) with the shared context
      const resolvedProxies = proxies.map(proxy => {
        if (proxy.configFactory) {
          const resolved = proxy.configFactory(enhancedContext);
          return {
            ...proxy,
            before: resolved.before,
            after: resolved.after,
            onError: resolved.onError,
            around: resolved.around,
          };
        }
        return proxy;
      });

      try {
        // Execute BEFORE interceptors
        for (const proxy of resolvedProxies) {
          // Check condition
          if (proxy.condition && !proxy.condition(enhancedContext)) {
            continue;
          }

          if (proxy.before) {
            await proxy.before(enhancedContext);

            // Check if execution was skipped
            if (enhancedContext._skipExecution) {
              return enhancedContext._overrideResult;
            }
          }
        }

        // Update args if modified
        const finalArgs = enhancedContext._modifiedArgs ?? enhancedContext.args;

        // Execute AROUND interceptors (only first one)
        const aroundProxy = resolvedProxies.find(
          p => p.around && (!p.condition || p.condition(enhancedContext))
        );

        let result: unknown;

        if (aroundProxy) {
          // Execute around interceptor
          result = await aroundProxy.around!(enhancedContext, async () => {
            return await originalMethod(...finalArgs);
          });
        } else {
          // Execute original method
          result = await originalMethod(...finalArgs);
        }

        // Execute AFTER interceptors
        for (const proxy of resolvedProxies) {
          // Check condition
          if (proxy.condition && !proxy.condition(enhancedContext)) {
            continue;
          }

          if (proxy.after) {
            result = await proxy.after(result, enhancedContext);
          }
        }

        return result;
      } catch (error) {
        // Execute ERROR interceptors
        for (const proxy of resolvedProxies) {
          // Check condition
          if (proxy.condition && !proxy.condition(enhancedContext)) {
            continue;
          }

          if (proxy.onError) {
            return await proxy.onError(error as Error, enhancedContext);
          }
        }

        // If no error handler, re-throw
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
