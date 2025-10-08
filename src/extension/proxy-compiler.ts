/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Proxy compiler
 * @description Compiles proxy metadata into method-specific proxies
 */

import { createPluginId } from '@/core';
import type { ProxyMetadata, CompiledMethodProxy } from './proxy-types';
import { shouldProxyMethod } from './proxy-types';

/**
 * Compiles proxy metadata into method-specific proxies
 *
 * @param api - Plugin API object
 * @param proxies - Array of proxy metadata to compile
 * @returns Array of compiled method proxies
 */
export function compileProxies<TApi extends object>(
  api: TApi,
  proxies: readonly ProxyMetadata[]
): CompiledMethodProxy[] {
  const compiled: CompiledMethodProxy[] = [];

  for (const proxyMeta of proxies) {
    const config = proxyMeta.config;

    const allMethodNames = Object.keys(api).filter(key => typeof (api as any)[key] === 'function');

    const targetMethods = allMethodNames.filter(methodName =>
      shouldProxyMethod(methodName, {
        include: config.include,
        exclude: config.exclude,
      })
    );

    for (const methodName of targetMethods) {
      compiled.push({
        targetPluginId:
          typeof proxyMeta.targetPluginId === 'string'
            ? createPluginId(proxyMeta.targetPluginId)
            : proxyMeta.targetPluginId,
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
