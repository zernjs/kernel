/**
 * @file Conflict detection and resolution for dependency management.
 * Provides comprehensive conflict analysis and resolution strategies.
 */

import type { DependencyConflict, ConflictType, Plugin } from '../types.js';
import type { DependencyGraph } from './graph.js';
import type { VersionResolver } from './version.js';

/**
 * Conflict resolution strategy.
 */
export type ConflictResolutionStrategy =
  | 'strict' // Fail on any conflict
  | 'permissive' // Allow conflicts with warnings
  | 'auto' // Attempt automatic resolution
  | 'interactive'; // Prompt for resolution (future)

/**
 * Conflict resolution result.
 */
export interface ConflictResolution {
  readonly strategy: ConflictResolutionStrategy;
  readonly resolved: boolean;
  readonly action: string;
  readonly warnings: readonly string[];
}

/**
 * Comprehensive conflict detector for dependency resolution.
 */
export class ConflictDetector {
  private readonly conflicts: DependencyConflict[] = [];
  private readonly strategy: ConflictResolutionStrategy;

  constructor(strategy: ConflictResolutionStrategy = 'strict') {
    this.strategy = strategy;
  }

  /**
   * Detects all types of conflicts in the dependency system.
   * @param graph - Dependency graph
   * @param versionResolver - Version resolver
   * @param plugins - Map of plugin instances
   * @returns Array of detected conflicts
   */
  detectConflicts(
    graph: DependencyGraph,
    versionResolver: VersionResolver,
    plugins: Map<string, Plugin>
  ): readonly DependencyConflict[] {
    this.conflicts.length = 0;

    // Detect different types of conflicts
    this.detectMissingDependencies(graph, plugins);
    this.detectVersionConflicts(versionResolver);
    this.detectCircularDependencies(graph);

    this.detectLoadOrderConflicts(graph, plugins);

    return [...this.conflicts];
  }

  /**
   * Attempts to resolve conflicts based on the configured strategy.
   * @param conflicts - Conflicts to resolve
   * @returns Map of conflict resolutions
   */
  resolveConflicts(
    conflicts: readonly DependencyConflict[]
  ): Map<DependencyConflict, ConflictResolution> {
    const resolutions = new Map<DependencyConflict, ConflictResolution>();

    for (const conflict of conflicts) {
      const resolution = this.resolveConflict(conflict);
      resolutions.set(conflict, resolution);
    }

    return resolutions;
  }

  /**
   * Generates a conflict report with detailed analysis.
   * @param conflicts - Conflicts to analyze
   * @returns Formatted conflict report
   */
  generateReport(conflicts: readonly DependencyConflict[]): string {
    if (conflicts.length === 0) {
      return 'No conflicts detected.';
    }

    const report: string[] = [];
    report.push(`Dependency Conflicts Report (${conflicts.length} conflicts found)`);
    report.push('='.repeat(60));

    const groupedConflicts = this.groupConflictsByType(conflicts);

    for (const [type, typeConflicts] of groupedConflicts) {
      report.push(`\n${type.toUpperCase()} CONFLICTS (${typeConflicts.length})`);
      report.push('-'.repeat(40));

      for (let i = 0; i < typeConflicts.length; i++) {
        const conflict = typeConflicts[i];
        report.push(`\n${i + 1}. ${conflict.message}`);
        report.push(`   Affected plugins: ${conflict.plugins.join(', ')}`);
        report.push(`   Suggestion: ${conflict.suggestion}`);

        if (conflict.details) {
          report.push(`   Details: ${JSON.stringify(conflict.details, null, 2)}`);
        }
      }
    }

    return report.join('\n');
  }

  /**
   * Detects missing dependency conflicts.
   */
  private detectMissingDependencies(graph: DependencyGraph, plugins: Map<string, Plugin>): void {
    for (const node of graph.getAllNodes()) {
      for (const dependency of node.dependencies) {
        if (!plugins.has(dependency) && !graph.getNode(dependency)) {
          this.conflicts.push({
            type: 'missing',
            message: `Plugin '${node.plugin.name}' depends on missing plugin '${dependency}'`,
            plugins: [node.plugin.name, dependency],
            suggestion: `Install plugin '${dependency}' or make the dependency optional`,
            details: {
              required: dependency,
              found: 'none',
            },
          });
        }
      }
    }
  }

  /**
   * Detects version conflicts using the version resolver.
   */
  private detectVersionConflicts(versionResolver: VersionResolver): void {
    const versionConflicts = versionResolver.detectConflicts();
    this.conflicts.push(...versionConflicts);
  }

  /**
   * Detects circular dependency conflicts.
   */
  private detectCircularDependencies(graph: DependencyGraph): void {
    const cycles = graph.detectCycles();

    for (const cycle of cycles) {
      this.conflicts.push({
        type: 'cycle',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        plugins: cycle,
        suggestion: 'Restructure dependencies to break the cycle',
        details: { cycle },
      });
    }
  }

  /**
   * Detects load order conflicts.
   */
  private detectLoadOrderConflicts(_graph: DependencyGraph, _plugins: Map<string, Plugin>): void {
    // This is a placeholder for load order conflict detection
    // Implementation would check for conflicting load order constraints
    // that cannot be satisfied simultaneously
  }

  /**
   * Resolves a single conflict based on the strategy.
   */
  private resolveConflict(conflict: DependencyConflict): ConflictResolution {
    switch (this.strategy) {
      case 'strict':
        return {
          strategy: 'strict',
          resolved: false,
          action: 'Fail initialization',
          warnings: [`Strict mode: ${conflict.message}`],
        };

      case 'permissive':
        return {
          strategy: 'permissive',
          resolved: true,
          action: 'Continue with warning',
          warnings: [`Permissive mode: ${conflict.message}`],
        };

      case 'auto':
        return this.attemptAutoResolution(conflict);

      case 'interactive':
        // Future implementation for interactive resolution
        return {
          strategy: 'interactive',
          resolved: false,
          action: 'Prompt user for resolution',
          warnings: [`Interactive resolution needed: ${conflict.message}`],
        };

      default:
        return {
          strategy: this.strategy,
          resolved: false,
          action: 'Unknown strategy',
          warnings: [`Unknown resolution strategy: ${this.strategy}`],
        };
    }
  }

  /**
   * Attempts automatic conflict resolution.
   */
  private attemptAutoResolution(conflict: DependencyConflict): ConflictResolution {
    switch (conflict.type) {
      case 'version':
        return {
          strategy: 'auto',
          resolved: true,
          action: 'Use highest compatible version',
          warnings: [`Auto-resolved version conflict: ${conflict.message}`],
        };

      case 'missing':
        return {
          strategy: 'auto',
          resolved: false,
          action: 'Cannot auto-resolve missing dependency',
          warnings: [`Missing dependency requires manual intervention: ${conflict.message}`],
        };

      case 'cycle':
        return {
          strategy: 'auto',
          resolved: false,
          action: 'Cannot auto-resolve circular dependency',
          warnings: [`Circular dependency requires manual restructuring: ${conflict.message}`],
        };

      case 'load-order':
        return {
          strategy: 'auto',
          resolved: true,
          action: 'Adjust load order automatically',
          warnings: [`Auto-resolved load order conflict: ${conflict.message}`],
        };

      default:
        return {
          strategy: 'auto',
          resolved: false,
          action: 'Unknown conflict type',
          warnings: [`Cannot auto-resolve unknown conflict type: ${conflict.type}`],
        };
    }
  }

  /**
   * Groups conflicts by type for reporting.
   */
  private groupConflictsByType(
    conflicts: readonly DependencyConflict[]
  ): Map<ConflictType, DependencyConflict[]> {
    const grouped = new Map<ConflictType, DependencyConflict[]>();

    for (const conflict of conflicts) {
      const existing = grouped.get(conflict.type) || [];
      existing.push(conflict);
      grouped.set(conflict.type, existing);
    }

    return grouped;
  }
}
