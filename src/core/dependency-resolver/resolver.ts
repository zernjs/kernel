/**
 * @file Main dependency resolver that coordinates all resolution components.
 * Provides the primary interface for dependency resolution and plugin initialization.
 */

import type {
  Plugin,
  ResolutionResult,
  DependencyConflict,
  KernelConfig,
  PluginRegistrationOptions,
} from '../types.js';
import { DependencyGraph } from './graph.js';
import { VersionResolver, type VersionRequirement, type VersionResolution } from './version.js';
import { TopologicalSorter, type LoadOrderSpec } from './sorter.js';
import {
  ConflictDetector,
  type ConflictResolutionStrategy,
  type ConflictResolution,
} from './conflicts.js';
import { parseVersion, parseConstraint } from '../utils/version.js';

/**
 * Plugin entry for resolution.
 */
export interface PluginEntry {
  readonly plugin: Plugin;
  readonly options: PluginRegistrationOptions;
}

/**
 * Resolution context containing all necessary information.
 */
export interface ResolutionContext {
  readonly plugins: Map<string, PluginEntry>;
  readonly config: Required<KernelConfig>;
  readonly strategy: ConflictResolutionStrategy;
}

/**
 * Detailed resolution result with comprehensive information.
 */
export interface DetailedResolutionResult extends ResolutionResult {
  readonly graph: DependencyGraph;
  readonly versionResolutions: Map<string, VersionResolution>;
  readonly loadOrder: readonly string[];
  readonly warnings: readonly string[];
  readonly resolutionTime: number;
}

/**
 * Main dependency resolver that coordinates all resolution components.
 */
export class DependencyResolver {
  private readonly conflictDetector: ConflictDetector;
  private readonly versionResolver: VersionResolver;

  constructor(strategy: ConflictResolutionStrategy = 'strict') {
    this.conflictDetector = new ConflictDetector(strategy);
    this.versionResolver = new VersionResolver();
  }

  /**
   * Resolves dependencies for a set of plugins.
   * @param context - Resolution context
   * @returns Detailed resolution result
   */
  async resolve(context: ResolutionContext): Promise<DetailedResolutionResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Step 1: Build dependency graph
      const graph = this.buildDependencyGraph(context.plugins);

      // Step 2: Setup version resolution
      this.setupVersionResolution(context.plugins);

      // Step 3: Detect conflicts
      const conflicts = this.conflictDetector.detectConflicts(
        graph,
        this.versionResolver,
        new Map(Array.from(context.plugins.entries()).map(([k, v]) => [k, v.plugin]))
      );

      // Step 4: Handle conflicts based on strategy
      const resolvedConflicts = this.conflictDetector.resolveConflicts(conflicts);
      const unresolvableConflicts = this.filterUnresolvableConflicts(resolvedConflicts);

      // Step 5: Generate load order specifications
      const loadOrderSpecs = this.generateLoadOrderSpecs(context.plugins);

      // Step 6: Perform topological sort
      const sortResult = TopologicalSorter.sortWithLoadOrder(graph, loadOrderSpecs);

      // Step 7: Validate final order
      const validationConflicts = TopologicalSorter.validateOrder(graph, sortResult.order);

      // Combine all conflicts
      const allConflicts = [...unresolvableConflicts, ...validationConflicts];

      // Step 8: Generate version resolutions
      const versionResolutions = this.versionResolver.resolveVersions();

      // Collect warnings from resolved conflicts
      for (const [, resolution] of resolvedConflicts) {
        warnings.push(...resolution.warnings);
      }

      const resolutionTime = Date.now() - startTime;

      return {
        success: allConflicts.length === 0,
        order: sortResult.order,
        conflicts: allConflicts,
        summary: this.generateSummary(sortResult.order, allConflicts, resolutionTime),
        graph,
        versionResolutions,
        loadOrder: sortResult.order,
        warnings,
        resolutionTime,
      };
    } catch (error) {
      const resolutionTime = Date.now() - startTime;

      return {
        success: false,
        order: [],
        conflicts: [
          {
            type: 'missing',
            message: `Resolution failed: ${error}`,
            plugins: [],
            suggestion: 'Check plugin configuration and dependencies',
          },
        ],
        summary: `Resolution failed after ${resolutionTime}ms: ${error}`,
        graph: new DependencyGraph(),
        versionResolutions: new Map(),
        loadOrder: [],
        warnings,
        resolutionTime,
      };
    }
  }

  /**
   * Validates a plugin configuration before resolution.
   * @param plugins - Plugins to validate
   * @returns Array of validation errors
   */
  validatePlugins(plugins: Map<string, PluginEntry>): readonly string[] {
    const errors: string[] = [];

    for (const [name, entry] of plugins) {
      const plugin = entry.plugin;

      // Validate plugin name consistency
      if (plugin.name !== name) {
        errors.push(
          `Plugin name mismatch: registered as '${name}' but plugin.name is '${plugin.name}'`
        );
      }

      // Validate version format
      try {
        parseVersion(plugin.version);
      } catch (error) {
        errors.push(`Invalid version '${plugin.version}' for plugin '${name}': ${error}`);
      }

      // Validate dependency constraints
      for (const dependency of plugin.dependencies) {
        if (dependency.version) {
          try {
            parseConstraint(dependency.version);
          } catch (error) {
            errors.push(
              `Invalid version constraint '${dependency.version}' in plugin '${name}': ${error}`
            );
          }
        }
      }
    }

    return errors;
  }

  /**
   * Gets resolution statistics for debugging.
   * @param result - Resolution result
   * @returns Statistics object
   */
  getStatistics(result: DetailedResolutionResult): Record<string, unknown> {
    return {
      totalPlugins: result.graph.size(),
      resolvedPlugins: result.order.length,
      conflicts: result.conflicts.length,
      warnings: result.warnings.length,
      resolutionTime: result.resolutionTime,
      conflictsByType: this.groupConflictsByType(result.conflicts),
      graphMetrics: {
        nodes: result.graph.size(),
        edges: result.graph.getAllEdges().length,
        rootNodes: result.graph.getRootNodes().length,
        leafNodes: result.graph.getLeafNodes().length,
      },
    };
  }

  /**
   * Builds the dependency graph from plugin entries.
   */
  private buildDependencyGraph(plugins: Map<string, PluginEntry>): DependencyGraph {
    const graph = new DependencyGraph();

    // Add all plugin nodes first
    for (const [, entry] of plugins) {
      graph.addNode(entry.plugin, entry.options.optional || false);
    }

    // Add dependency edges
    for (const [name, entry] of plugins) {
      for (const dependency of entry.plugin.dependencies) {
        const depName = dependency.plugin.name;

        // Only add edge if target plugin exists
        if (plugins.has(depName)) {
          graph.addEdge(name, depName, dependency.version, false);
        }
      }
    }

    return graph;
  }

  /**
   * Sets up version resolution for all plugins.
   */
  private setupVersionResolution(plugins: Map<string, PluginEntry>): void {
    this.versionResolver.clear();

    // Set available versions for each plugin
    for (const [name, entry] of plugins) {
      this.versionResolver.setAvailableVersions(name, [entry.plugin.version]);
    }

    // Add version requirements from dependencies
    for (const [name, entry] of plugins) {
      for (const dependency of entry.plugin.dependencies) {
        if (dependency.version) {
          const requirement: VersionRequirement = {
            plugin: dependency.plugin.name,
            constraint: parseConstraint(dependency.version),
            requiredBy: name,
            optional: false,
          };

          this.versionResolver.addRequirement(requirement);
        }
      }
    }
  }

  /**
   * Generates load order specifications from plugin options.
   */
  private generateLoadOrderSpecs(plugins: Map<string, PluginEntry>): readonly LoadOrderSpec[] {
    const specs: LoadOrderSpec[] = [];

    for (const [name, entry] of plugins) {
      const loadOrder = entry.options.loadOrder;
      if (loadOrder) {
        specs.push({
          plugin: name,
          loadBefore: loadOrder.loadBefore || [],
          loadAfter: loadOrder.loadAfter || [],
        });
      }
    }

    return specs;
  }

  /**
   * Filters out resolvable conflicts, keeping only unresolvable ones.
   */
  private filterUnresolvableConflicts(
    resolvedConflicts: Map<DependencyConflict, ConflictResolution>
  ): readonly DependencyConflict[] {
    const unresolvable: DependencyConflict[] = [];

    for (const [conflict, resolution] of resolvedConflicts) {
      if (!resolution.resolved) {
        unresolvable.push(conflict);
      }
    }

    return unresolvable;
  }

  /**
   * Generates a summary of the resolution process.
   */
  private generateSummary(
    order: readonly string[],
    conflicts: readonly DependencyConflict[],
    resolutionTime: number
  ): string {
    if (conflicts.length === 0) {
      return (
        `Successfully resolved ${order.length} plugins in ${resolutionTime}ms. ` +
        `Load order: ${order.join(' -> ')}`
      );
    } else {
      return (
        `Resolution failed with ${conflicts.length} conflicts after ${resolutionTime}ms. ` +
        `Conflicts: ${conflicts.map(c => c.type).join(', ')}`
      );
    }
  }

  /**
   * Groups conflicts by type for statistics.
   */
  private groupConflictsByType(conflicts: readonly DependencyConflict[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const conflict of conflicts) {
      grouped[conflict.type] = (grouped[conflict.type] || 0) + 1;
    }

    return grouped;
  }
}

/**
 * Creates a dependency resolver with the specified strategy.
 * @param strategy - Conflict resolution strategy
 * @returns Configured dependency resolver
 */
export function createDependencyResolver(
  strategy: ConflictResolutionStrategy = 'strict'
): DependencyResolver {
  return new DependencyResolver(strategy);
}

/**
 * Quick resolution function for simple use cases.
 * @param plugins - Plugins to resolve
 * @param config - Kernel configuration
 * @returns Resolution result
 */
export async function quickResolve(
  plugins: Map<string, Plugin>,
  config: Required<KernelConfig> = {
    autoGlobal: true,
    strictVersioning: true,
    allowCircularDependencies: false,
  }
): Promise<ResolutionResult> {
  const resolver = createDependencyResolver(config.strictVersioning ? 'strict' : 'permissive');

  const pluginEntries = new Map<string, PluginEntry>();
  for (const [name, plugin] of plugins) {
    pluginEntries.set(name, { plugin, options: {} });
  }

  const context: ResolutionContext = {
    plugins: pluginEntries,
    config,
    strategy: config.strictVersioning ? 'strict' : 'permissive',
  };

  const result = await resolver.resolve(context);

  return {
    success: result.success,
    order: result.order,
    conflicts: result.conflicts,
    summary: result.summary,
  };
}
