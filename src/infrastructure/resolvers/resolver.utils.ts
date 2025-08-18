/**
 * @file Utility functions for dependency resolution.
 */

import type { Plugin } from '../../domain/plugin/plugin.types.js';
import type { KernelConfig } from '../../domain/kernel/kernel.types.js';
import type { ResolutionResult } from '../../domain/dependency/dependency.types.js';
import type { ConflictResolutionStrategy } from './conflicts.js';
import { createKernelId } from '../../shared/types/common.types.js';
import { DependencyResolver } from './resolver.js';
import type { PluginEntry, ResolutionContext } from './resolver.types.js';

/**
 * Creates a new dependency resolver with the specified strategy.
 * @param strategy - Conflict resolution strategy
 * @returns New dependency resolver instance
 */
export function createDependencyResolver(
  strategy: ConflictResolutionStrategy = 'strict'
): DependencyResolver {
  return new DependencyResolver(strategy);
}

/**
 * Quick resolution utility for simple use cases.
 * @param plugins - Map of plugins to resolve
 * @param config - Kernel configuration
 * @returns Resolution result
 */
export async function quickResolve(
  plugins: Map<string, Plugin>,
  config: Required<KernelConfig> = {
    id: createKernelId('default-kernel'),
    autoGlobal: true,
    strictVersioning: true,
    allowCircularDependencies: false,
    timeout: 5000,
    retries: 3,
    debug: false,
    maxPlugins: 100,
    maxDependencyDepth: 10,
    maxInitializationTime: 30000,
    enableExtensions: true,
    logLevel: 'info',
  }
): Promise<ResolutionResult> {
  const resolver = createDependencyResolver('strict');

  const pluginEntries = new Map<string, PluginEntry>();
  for (const [name, plugin] of Array.from(plugins)) {
    pluginEntries.set(name, {
      plugin,
      options: { config: { priority: 0 } },
    });
  }

  const context: ResolutionContext = {
    plugins: pluginEntries,
    config,
    strategy: 'strict',
  };

  const result = await resolver.resolve(context);

  return {
    success: result.success,
    order: result.order,
    conflicts: result.conflicts,
    summary: result.summary,
  };
}
