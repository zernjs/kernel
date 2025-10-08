/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Proxy context helper
 * @description Helper to create enhanced proxy contexts (DRY helper)
 */

import type { ProxyContext } from './proxy-types';
import { enhanceContext } from './proxy-types';
import type { ProxySourceInfo } from './extension';

/**
 * Creates an enhanced proxy context with all necessary data
 *
 * This is a DRY helper to avoid repeating context creation logic
 *
 * @param pluginName - Name of the plugin being proxied
 * @param methodName - Name of the method being called
 * @param args - Arguments passed to the method
 * @param plugins - Record of available plugins with their APIs
 * @param sourcePluginId - Optional ID of the plugin that registered the proxy
 * @param proxyStore - Store of the proxy source plugin
 * @param proxySourceInfos - Map of plugin IDs to their store info
 * @returns Enhanced ProxyContext ready for use
 */
export function createProxyContext(
  pluginName: string,
  methodName: string,
  args: unknown[],
  plugins: Record<string, unknown>,
  sourcePluginId: string | undefined,
  proxyStore: unknown,
  proxySourceInfos: Record<string, ProxySourceInfo>
): ProxyContext<any, any, any> {
  const store = sourcePluginId
    ? (proxySourceInfos[sourcePluginId]?.store ?? proxyStore)
    : proxyStore;

  return enhanceContext({
    pluginName,
    plugins,
    method: methodName,
    args,
    store,
  } as any);
}
