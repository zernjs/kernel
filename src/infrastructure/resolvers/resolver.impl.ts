/**
 * @file Dependency Resolver Implementation
 * Contains the main DependencyResolver class implementation.
 */

import type { DependencyConflict } from '../../domain/dependency/dependency.types.js';
import { ConflictType } from '../../domain/dependency/dependency.types.js';
import type { PluginId } from '../../shared/types/common.types.js';
import { DependencyGraph } from './graph.js';
import { VersionResolver, type VersionRequirement } from './version.js';
import { TopologicalSorter, type LoadOrderSpec } from './sorter.js';
import {
  ConflictDetector,
  type ConflictResolutionStrategy,
  type ConflictResolution,
} from './conflicts.js';
import { parseConstraint } from '../../shared/utils/version.utils.js';
import type { PluginEntry, ResolutionContext, DetailedResolutionResult } from './resolver.types.js';
import { validatePlugins } from './resolver.validation.js';
import { getStatistics, generateSummary } from './resolver.statistics.js';

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
      for (const [, resolution] of Array.from(resolvedConflicts)) {
        warnings.push(...resolution.warnings);
      }

      const resolutionTime = Date.now() - startTime;

      return {
        graph,
        versionResolutions,
        loadOrder: sortResult.order,
        warnings,
        resolutionTime,
        // ResolutionResult properties
        success: allConflicts.length === 0,
        order: sortResult.order,
        conflicts: allConflicts,
        summary: generateSummary(sortResult.order, allConflicts, resolutionTime),
      };
    } catch (error) {
      const resolutionTime = Date.now() - startTime;

      return {
        graph: new DependencyGraph(),
        versionResolutions: new Map(),
        loadOrder: [],
        warnings,
        resolutionTime,
        // ResolutionResult properties
        success: false,
        order: [],
        conflicts: [
          {
            type: ConflictType.MISSING_DEPENDENCY,
            pluginId: '' as PluginId,
            dependencyId: '' as PluginId,
            description: `Resolution failed: ${error}`,
            severity: 'error' as const,
            suggestedResolution: 'Check plugin dependencies and versions',
          },
        ],
        summary: `Resolution failed after ${resolutionTime}ms: ${error}`,
      };
    }
  }

  /**
   * Validates a plugin configuration before resolution.
   * @param plugins - Plugins to validate
   * @returns Array of validation errors
   */
  validatePlugins(plugins: Map<string, PluginEntry>): readonly string[] {
    return validatePlugins(plugins);
  }

  /**
   * Gets resolution statistics for debugging.
   * @param result - Resolution result
   * @returns Statistics object
   */
  getStatistics(result: DetailedResolutionResult): Record<string, unknown> {
    return getStatistics(result);
  }

  /**
   * Builds a dependency graph from plugin entries.
   */
  private buildDependencyGraph(plugins: Map<string, PluginEntry>): DependencyGraph {
    const graph = new DependencyGraph();

    // Add all plugins as nodes
    for (const [, entry] of Array.from(plugins)) {
      graph.addNode(entry.plugin, entry.options.config?.optional || false);
    }

    // Add dependency edges
    for (const [name, entry] of Array.from(plugins)) {
      for (const dependency of entry.plugin.dependencies) {
        if (plugins.has(dependency.pluginId)) {
          graph.addEdge(name, dependency.pluginId);
        }
      }
    }

    return graph;
  }

  /**
   * Sets up version resolution requirements.
   */
  private setupVersionResolution(plugins: Map<string, PluginEntry>): void {
    this.versionResolver.clear();

    // Set available versions for each plugin
    for (const [name, entry] of Array.from(plugins)) {
      this.versionResolver.setAvailableVersions(name, [entry.plugin.version]);
    }

    // Add version requirements from dependencies
    for (const [name, entry] of Array.from(plugins)) {
      for (const dependency of entry.plugin.dependencies) {
        if (dependency.versionConstraint) {
          const requirement: VersionRequirement = {
            plugin: dependency.pluginId,
            constraint: parseConstraint(dependency.versionConstraint),
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

    for (const [name, entry] of Array.from(plugins)) {
      const config = entry.options.config;
      if (config?.priority) {
        specs.push({
          plugin: name,
          loadBefore: [], // PluginConfig.priority is a number, not an object
          loadAfter: [], // Load order should be handled differently
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

    for (const [conflict, resolution] of Array.from(resolvedConflicts)) {
      if (!resolution.resolved) {
        unresolvable.push(conflict);
      }
    }

    return unresolvable;
  }
}
