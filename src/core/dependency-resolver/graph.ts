/**
 * @file Dependency graph representation and manipulation.
 * Provides a directed graph structure for plugin dependencies.
 */

import type { Plugin } from '../types.js';

/**
 * Represents a node in the dependency graph.
 */
export interface DependencyNode {
  readonly plugin: Plugin;
  readonly dependencies: Set<string>;
  readonly dependents: Set<string>;
  readonly optional: boolean;
}

/**
 * Represents an edge in the dependency graph.
 */
export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
  readonly version?: string;
  readonly optional: boolean;
}

/**
 * Directed graph for managing plugin dependencies.
 */
export class DependencyGraph {
  private readonly nodes = new Map<string, DependencyNode>();
  private readonly edges: DependencyEdge[] = [];

  /**
   * Adds a plugin node to the graph.
   * @param plugin - Plugin to add
   * @param optional - Whether this plugin is optional
   * @throws {Error} If plugin is already in the graph
   */
  addNode(plugin: Plugin, optional = false): void {
    if (this.nodes.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already in the dependency graph`);
    }

    this.nodes.set(plugin.name, {
      plugin,
      dependencies: new Set(),
      dependents: new Set(),
      optional,
    });
  }

  /**
   * Adds a dependency edge between two plugins.
   * @param from - Plugin that depends on another
   * @param to - Plugin that is depended upon
   * @param version - Version constraint
   * @param optional - Whether this dependency is optional
   * @throws {Error} If either plugin is not in the graph
   */
  addEdge(from: string, to: string, version?: string, optional = false): void {
    const fromNode = this.nodes.get(from);
    const toNode = this.nodes.get(to);

    if (!fromNode) {
      throw new Error(`Plugin '${from}' is not in the dependency graph`);
    }

    if (!toNode) {
      throw new Error(`Plugin '${to}' is not in the dependency graph`);
    }

    // Add to internal structures
    fromNode.dependencies.add(to);
    toNode.dependents.add(from);

    this.edges.push({ from, to, version, optional });
  }

  /**
   * Removes a plugin node and all its edges from the graph.
   * @param name - Plugin name to remove
   */
  removeNode(name: string): void {
    const node = this.nodes.get(name);
    if (!node) {
      return;
    }

    // Remove all edges involving this node
    for (const dependency of node.dependencies) {
      this.removeEdge(name, dependency);
    }

    for (const dependent of node.dependents) {
      this.removeEdge(dependent, name);
    }

    this.nodes.delete(name);
  }

  /**
   * Removes a dependency edge between two plugins.
   * @param from - Source plugin
   * @param to - Target plugin
   */
  removeEdge(from: string, to: string): void {
    const fromNode = this.nodes.get(from);
    const toNode = this.nodes.get(to);

    if (fromNode) {
      fromNode.dependencies.delete(to);
    }

    if (toNode) {
      toNode.dependents.delete(from);
    }

    const edgeIndex = this.edges.findIndex(edge => edge.from === from && edge.to === to);
    if (edgeIndex >= 0) {
      this.edges.splice(edgeIndex, 1);
    }
  }

  /**
   * Gets a plugin node by name.
   * @param name - Plugin name
   * @returns Plugin node or undefined if not found
   */
  getNode(name: string): DependencyNode | undefined {
    return this.nodes.get(name);
  }

  /**
   * Gets all plugin nodes in the graph.
   */
  getAllNodes(): readonly DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Gets all edges in the graph.
   */
  getAllEdges(): readonly DependencyEdge[] {
    return [...this.edges];
  }

  /**
   * Gets direct dependencies of a plugin.
   * @param name - Plugin name
   * @returns Array of dependency names
   */
  getDependencies(name: string): readonly string[] {
    const node = this.nodes.get(name);
    return node ? Array.from(node.dependencies) : [];
  }

  /**
   * Gets direct dependents of a plugin.
   * @param name - Plugin name
   * @returns Array of dependent names
   */
  getDependents(name: string): readonly string[] {
    const node = this.nodes.get(name);
    return node ? Array.from(node.dependents) : [];
  }

  /**
   * Checks if there's a path from one plugin to another.
   * @param from - Source plugin
   * @param to - Target plugin
   * @returns True if path exists
   */
  hasPath(from: string, to: string): boolean {
    if (from === to) {
      return true;
    }

    const visited = new Set<string>();
    const stack = [from];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      if (current === to) {
        return true;
      }

      const dependencies = this.getDependencies(current);
      for (const dependency of dependencies) {
        if (!visited.has(dependency)) {
          stack.push(dependency);
        }
      }
    }

    return false;
  }

  /**
   * Detects circular dependencies in the graph.
   * @returns Array of cycles found
   */
  detectCycles(): readonly string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) {
        this.detectCyclesRecursive(node, visited, recursionStack, path, cycles);
      }
    }

    return cycles;
  }

  /**
   * Gets nodes with no dependencies (root nodes).
   */
  getRootNodes(): readonly string[] {
    return Array.from(this.nodes.entries())
      .filter(([, node]) => node.dependencies.size === 0)
      .map(([name]) => name);
  }

  /**
   * Gets nodes with no dependents (leaf nodes).
   */
  getLeafNodes(): readonly string[] {
    return Array.from(this.nodes.entries())
      .filter(([, node]) => node.dependents.size === 0)
      .map(([name]) => name);
  }

  /**
   * Checks if the graph is empty.
   */
  isEmpty(): boolean {
    return this.nodes.size === 0;
  }

  /**
   * Gets the number of nodes in the graph.
   */
  size(): number {
    return this.nodes.size;
  }

  /**
   * Creates a copy of the graph.
   */
  clone(): DependencyGraph {
    const cloned = new DependencyGraph();

    // Add all nodes
    for (const [, node] of this.nodes) {
      cloned.addNode(node.plugin, node.optional);
    }

    // Add all edges
    for (const edge of this.edges) {
      cloned.addEdge(edge.from, edge.to, edge.version, edge.optional);
    }

    return cloned;
  }

  /**
   * Recursive helper for cycle detection.
   */
  private detectCyclesRecursive(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: string[][]
  ): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const dependencies = this.getDependencies(node);
    for (const dependency of dependencies) {
      if (!visited.has(dependency)) {
        this.detectCyclesRecursive(dependency, visited, recursionStack, path, cycles);
      } else if (recursionStack.has(dependency)) {
        // Found a cycle
        const cycleStart = path.indexOf(dependency);
        const cycle = path.slice(cycleStart).concat([dependency]);
        cycles.push(cycle);
      }
    }

    recursionStack.delete(node);
    path.pop();
  }
}
