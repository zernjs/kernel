/**
 * @file Main dependency resolver interfaces and convenience functions.
 * Provides the primary interface for dependency resolution and plugin initialization.
 */

import type { ConflictResolutionStrategy } from './conflicts.js';
import type { PluginEntry, ResolutionContext, DetailedResolutionResult } from './resolver.types.js';
import { DependencyResolver as DependencyResolverImpl } from './resolver.impl.js';

// Re-export types for convenience
export type { PluginEntry, ResolutionContext, DetailedResolutionResult } from './resolver.types.js';
export type { ConflictResolutionStrategy } from './conflicts.js';

/**
 * Interface for dependency resolver.
 */
export interface IDependencyResolver {
  /**
   * Resolves dependencies for a set of plugins.
   * @param context - Resolution context
   * @returns Detailed resolution result
   */
  resolve(context: ResolutionContext): Promise<DetailedResolutionResult>;

  /**
   * Validates a plugin configuration before resolution.
   * @param plugins - Plugins to validate
   * @returns Array of validation errors
   */
  validatePlugins(plugins: Map<string, PluginEntry>): readonly string[];

  /**
   * Gets resolution statistics for debugging.
   * @param result - Resolution result
   * @returns Statistics object
   */
  getStatistics(result: DetailedResolutionResult): Record<string, unknown>;
}

/**
 * Main dependency resolver that coordinates all resolution components.
 */
export class DependencyResolver extends DependencyResolverImpl implements IDependencyResolver {}

// Convenience functions
export function createDependencyResolver(
  strategy: ConflictResolutionStrategy = 'strict'
): IDependencyResolver {
  return new DependencyResolver(strategy);
}

export function createStrictResolver(): IDependencyResolver {
  return new DependencyResolver('strict');
}

export function createLenientResolver(): IDependencyResolver {
  return new DependencyResolver('permissive');
}

// Re-export utilities
export { createDependencyResolver as createResolver, quickResolve } from './resolver.utils.js';
