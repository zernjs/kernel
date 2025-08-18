/**
 * @file Resolver Statistics Utilities
 * Contains statistics generation and summary logic for resolution results.
 */

import type { DependencyConflict } from '../../domain/dependency/dependency.types.js';
import type { DetailedResolutionResult } from './resolver.types.js';

/**
 * Gets resolution statistics for debugging.
 * @param result - Resolution result
 * @returns Statistics object
 */
export function getStatistics(result: DetailedResolutionResult): Record<string, unknown> {
  return {
    totalPlugins: result.graph.size(),
    resolvedPlugins: result.order.length,
    conflicts: result.conflicts.length,
    warnings: result.warnings.length,
    resolutionTime: result.resolutionTime,
    conflictsByType: groupConflictsByType(result.conflicts),
    graphMetrics: {
      nodes: result.graph.size(),
      edges: result.graph.getAllEdges().length,
      rootNodes: result.graph.getRootNodes().length,
    },
  };
}

/**
 * Generates a human-readable summary of the resolution process.
 * @param order - Resolved plugin order
 * @param conflicts - Detected conflicts
 * @param resolutionTime - Time taken for resolution
 * @returns Summary string
 */
export function generateSummary(
  order: readonly string[],
  conflicts: readonly DependencyConflict[],
  resolutionTime: number
): string {
  const pluginCount = order.length;
  const conflictCount = conflicts.length;
  const conflictsByType = groupConflictsByType(conflicts);

  let summary = `Resolved ${pluginCount} plugins in ${resolutionTime}ms`;

  if (conflictCount > 0) {
    summary += ` with ${conflictCount} conflicts:`;
    for (const [type, count] of Object.entries(conflictsByType)) {
      summary += ` ${type}(${count})`;
    }
  }

  return summary;
}

/**
 * Groups conflicts by their type for statistics.
 * @param conflicts - Array of conflicts
 * @returns Object mapping conflict types to counts
 */
export function groupConflictsByType(
  conflicts: readonly DependencyConflict[]
): Record<string, number> {
  const groups: Record<string, number> = {};

  for (const conflict of conflicts) {
    const type = conflict.type;
    groups[type] = (groups[type] || 0) + 1;
  }

  return groups;
}
