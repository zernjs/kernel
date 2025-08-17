/**
 * @file Topological sorting for dependency resolution.
 * Provides algorithms to determine the correct initialization order.
 */

import type { DependencyGraph } from './graph.js';
import type { DependencyConflict } from '../types.js';

/**
 * Result of topological sorting.
 */
export interface SortResult {
  readonly success: boolean;
  readonly order: readonly string[];
  readonly cycles: readonly string[][];
  readonly conflicts: readonly DependencyConflict[];
}

/**
 * Load order specification for a plugin.
 */
export interface LoadOrderSpec {
  readonly plugin: string;
  readonly loadBefore: readonly string[];
  readonly loadAfter: readonly string[];
}

/**
 * Topological sorter for dependency graphs.
 */
export class TopologicalSorter {
  /**
   * Performs topological sort using Kahn's algorithm.
   * @param graph - Dependency graph to sort
   * @returns Sort result with order or cycles
   */
  static sort(graph: DependencyGraph): SortResult {
    const conflicts: DependencyConflict[] = [];

    // First detect cycles
    const cycles = graph.detectCycles();
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        conflicts.push({
          type: 'cycle',
          message: `Circular dependency detected: ${cycle.join(' -> ')}`,
          plugins: cycle,
          suggestion: 'Remove or restructure dependencies to break the cycle',
          details: { cycle },
        });
      }

      return {
        success: false,
        order: [],
        cycles,
        conflicts,
      };
    }

    // Perform Kahn's algorithm
    const order = TopologicalSorter.kahnsAlgorithm(graph);

    return {
      success: true,
      order,
      cycles: [],
      conflicts,
    };
  }

  /**
   * Performs topological sort with load order constraints.
   * @param graph - Dependency graph
   * @param loadOrderSpecs - Load order specifications
   * @returns Sort result with constraints applied
   */
  static sortWithLoadOrder(
    graph: DependencyGraph,
    loadOrderSpecs: readonly LoadOrderSpec[]
  ): SortResult {
    const conflicts: DependencyConflict[] = [];

    // Create a copy of the graph to add load order constraints
    const constrainedGraph = graph.clone();

    // Add load order constraints as additional edges
    for (const spec of loadOrderSpecs) {
      try {
        TopologicalSorter.applyLoadOrderConstraints(constrainedGraph, spec, conflicts);
      } catch (error) {
        conflicts.push({
          type: 'load-order',
          message: `Failed to apply load order constraints for '${spec.plugin}': ${error}`,
          plugins: [spec.plugin],
          suggestion: 'Check that load order constraints reference valid plugins',
        });
      }
    }

    // Detect cycles after adding constraints
    const cycles = constrainedGraph.detectCycles();
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        conflicts.push({
          type: 'cycle',
          message: `Load order constraints created circular dependency: ${cycle.join(' -> ')}`,
          plugins: cycle,
          suggestion: 'Adjust load order constraints to avoid cycles',
          details: { cycle },
        });
      }

      return {
        success: false,
        order: [],
        cycles,
        conflicts,
      };
    }

    // Perform topological sort
    const order = TopologicalSorter.kahnsAlgorithm(constrainedGraph);

    return {
      success: true,
      order,
      cycles: [],
      conflicts,
    };
  }

  /**
   * Performs depth-first search based topological sort.
   * Alternative to Kahn's algorithm, useful for debugging.
   * @param graph - Dependency graph to sort
   * @returns Topologically sorted order
   */
  static dfsSort(graph: DependencyGraph): readonly string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const result: string[] = [];

    const nodes = graph.getAllNodes();

    for (const node of nodes) {
      if (!visited.has(node.plugin.name)) {
        TopologicalSorter.dfsVisit(graph, node.plugin.name, visited, recursionStack, result);
      }
    }

    return result.reverse();
  }

  /**
   * Validates that a given order respects all dependencies.
   * @param graph - Dependency graph
   * @param order - Proposed initialization order
   * @returns Validation conflicts
   */
  static validateOrder(
    graph: DependencyGraph,
    order: readonly string[]
  ): readonly DependencyConflict[] {
    const conflicts: DependencyConflict[] = [];
    const position = new Map<string, number>();

    // Build position map
    order.forEach((plugin, index) => {
      position.set(plugin, index);
    });

    // Check each plugin's dependencies
    for (const node of graph.getAllNodes()) {
      const pluginPos = position.get(node.plugin.name);
      if (pluginPos === undefined) {
        continue;
      }

      for (const dependency of node.dependencies) {
        const depPos = position.get(dependency);
        if (depPos === undefined) {
          conflicts.push({
            type: 'missing',
            message: `Plugin '${node.plugin.name}' depends on '${dependency}' which is not in the initialization order`,
            plugins: [node.plugin.name, dependency],
            suggestion: `Add '${dependency}' to the initialization order before '${node.plugin.name}'`,
          });
        } else if (depPos > pluginPos) {
          conflicts.push({
            type: 'load-order',
            message: `Plugin '${node.plugin.name}' must be initialized after its dependency '${dependency}'`,
            plugins: [node.plugin.name, dependency],
            suggestion: `Move '${dependency}' before '${node.plugin.name}' in the initialization order`,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Implements Kahn's algorithm for topological sorting.
   * @param graph - Dependency graph
   * @returns Topologically sorted order
   */
  private static kahnsAlgorithm(graph: DependencyGraph): readonly string[] {
    const result: string[] = [];
    const inDegree = new Map<string, number>();
    const queue: string[] = [];

    // Calculate in-degrees
    for (const node of graph.getAllNodes()) {
      inDegree.set(node.plugin.name, node.dependencies.size);
    }

    // Find nodes with no incoming edges
    for (const [plugin, degree] of inDegree) {
      if (degree === 0) {
        queue.push(plugin);
      }
    }

    // Process nodes
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      // Update in-degrees of dependents
      const dependents = graph.getDependents(current);
      for (const dependent of dependents) {
        const newDegree = (inDegree.get(dependent) || 0) - 1;
        inDegree.set(dependent, newDegree);

        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    return result;
  }

  /**
   * Applies load order constraints to a graph.
   * @param graph - Graph to modify
   * @param spec - Load order specification
   * @param conflicts - Array to collect conflicts
   */
  private static applyLoadOrderConstraints(
    graph: DependencyGraph,
    spec: LoadOrderSpec,
    conflicts: DependencyConflict[]
  ): void {
    const plugin = spec.plugin;

    // Validate that the plugin exists
    if (!graph.getNode(plugin)) {
      throw new Error(`Plugin '${plugin}' not found in graph`);
    }

    // Add edges for loadBefore constraints
    for (const target of spec.loadBefore) {
      if (!graph.getNode(target)) {
        conflicts.push({
          type: 'load-order',
          message: `Load order constraint references unknown plugin '${target}'`,
          plugins: [plugin, target],
          suggestion: `Remove reference to '${target}' or add it to the graph`,
        });
        continue;
      }

      // Plugin should load before target, so target depends on plugin
      try {
        graph.addEdge(target, plugin, undefined, true);
      } catch {
        // Edge might already exist, ignore
      }
    }

    // Add edges for loadAfter constraints
    for (const target of spec.loadAfter) {
      if (!graph.getNode(target)) {
        conflicts.push({
          type: 'load-order',
          message: `Load order constraint references unknown plugin '${target}'`,
          plugins: [plugin, target],
          suggestion: `Remove reference to '${target}' or add it to the graph`,
        });
        continue;
      }

      // Plugin should load after target, so plugin depends on target
      try {
        graph.addEdge(plugin, target, undefined, true);
      } catch {
        // Edge might already exist, ignore
      }
    }
  }

  /**
   * DFS visit helper for depth-first topological sort.
   * @param graph - Dependency graph
   * @param node - Current node
   * @param visited - Set of visited nodes
   * @param recursionStack - Current recursion stack
   * @param result - Result array
   */
  private static dfsVisit(
    graph: DependencyGraph,
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    result: string[]
  ): void {
    visited.add(node);
    recursionStack.add(node);

    const dependencies = graph.getDependencies(node);
    for (const dependency of dependencies) {
      if (!visited.has(dependency)) {
        TopologicalSorter.dfsVisit(graph, dependency, visited, recursionStack, result);
      } else if (recursionStack.has(dependency)) {
        throw new Error(`Cycle detected: ${node} -> ${dependency}`);
      }
    }

    recursionStack.delete(node);
    result.push(node);
  }
}
