/**
 * @file Plugin dependency resolver for the Zern Kernel
 * @description Using a topological sort algorithm to resolve plugin dependencies
 */

import type { PluginId, PluginMetadata, Result } from '@/core';
import { success, failure, CircularDependencyError, PluginDependencyError } from '@/core';
import { satisfiesVersion } from '@/utils';

export interface DependencyResolver {
  resolve(
    plugins: readonly PluginMetadata[]
  ): Result<readonly PluginId[], CircularDependencyError | PluginDependencyError>;
}

export class DependencyResolverImpl implements DependencyResolver {
  resolve(
    plugins: readonly PluginMetadata[]
  ): Result<readonly PluginId[], CircularDependencyError | PluginDependencyError> {
    const validationResult = this.validateDependencies(plugins);
    if (!validationResult.success) {
      return validationResult;
    }

    const cycleResult = this.detectCycles(plugins);
    if (!cycleResult.success) {
      return cycleResult;
    }

    return this.topologicalSort(plugins);
  }

  private validateDependencies(
    plugins: readonly PluginMetadata[]
  ): Result<void, PluginDependencyError> {
    const pluginMap = new Map(plugins.map(p => [p.id, p]));

    for (const plugin of plugins) {
      for (const dep of plugin.dependencies) {
        const depPlugin = pluginMap.get(dep.pluginId);

        if (!depPlugin) {
          return failure(new PluginDependencyError(plugin.name, dep.pluginId));
        }

        if (!satisfiesVersion(depPlugin.version, dep.versionRange)) {
          return failure(
            new PluginDependencyError(plugin.name, `${dep.pluginId}@${dep.versionRange}`)
          );
        }
      }
    }

    return success(undefined);
  }

  private detectCycles(plugins: readonly PluginMetadata[]): Result<void, CircularDependencyError> {
    const visited = new Set<PluginId>();
    const recursionStack = new Set<PluginId>();
    const pluginMap = new Map(plugins.map(p => [p.id, p]));

    for (const plugin of plugins) {
      if (!visited.has(plugin.id)) {
        const cycle = this.dfsDetectCycle(plugin.id, pluginMap, visited, recursionStack, []);

        if (cycle) {
          return failure(new CircularDependencyError(cycle));
        }
      }
    }

    return success(undefined);
  }

  private dfsDetectCycle(
    pluginId: PluginId,
    pluginMap: Map<PluginId, PluginMetadata>,
    visited: Set<PluginId>,
    recursionStack: Set<PluginId>,
    path: string[]
  ): string[] | null {
    visited.add(pluginId);
    recursionStack.add(pluginId);

    const plugin = pluginMap.get(pluginId);
    if (!plugin) return null;

    const currentPath = [...path, plugin.name];

    for (const dep of plugin.dependencies) {
      if (!visited.has(dep.pluginId)) {
        const cycle = this.dfsDetectCycle(
          dep.pluginId,
          pluginMap,
          visited,
          recursionStack,
          currentPath
        );

        if (cycle) return cycle;
      } else if (recursionStack.has(dep.pluginId)) {
        const depPlugin = pluginMap.get(dep.pluginId);
        return [...currentPath, depPlugin?.name ?? dep.pluginId];
      }
    }

    recursionStack.delete(pluginId);

    return null;
  }

  private topologicalSort(plugins: readonly PluginMetadata[]): Result<readonly PluginId[], never> {
    const inDegree = new Map<PluginId, number>();
    const adjList = new Map<PluginId, PluginId[]>();

    for (const plugin of plugins) {
      inDegree.set(plugin.id, 0);
      adjList.set(plugin.id, []);
    }

    for (const plugin of plugins) {
      for (const dep of plugin.dependencies) {
        adjList.get(dep.pluginId)?.push(plugin.id);
        inDegree.set(plugin.id, (inDegree.get(plugin.id) ?? 0) + 1);
      }
    }

    // Kahn's algorithm
    const queue: PluginId[] = [];
    const result: PluginId[] = [];

    for (const [pluginId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(pluginId);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighboor of adjList.get(current) ?? []) {
        const newDegree = (inDegree.get(neighboor) ?? 0) - 1;
        inDegree.set(neighboor, newDegree);

        if (newDegree === 0) {
          queue.push(neighboor);
        }
      }
    }

    return success(result);
  }
}

export function createDependencyResolver(): DependencyResolver {
  return new DependencyResolverImpl();
}
