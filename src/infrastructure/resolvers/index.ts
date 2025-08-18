/**
 * @file Dependency resolver module exports.
 * Provides a unified interface for all dependency resolution functionality.
 */

export { DependencyGraph } from './graph.js';
export { VersionResolver, type VersionRequirement, type VersionResolution } from './version.js';
export { TopologicalSorter, type LoadOrderSpec, type SortResult } from './sorter.js';
export {
  ConflictDetector,
  type ConflictResolutionStrategy,
  type ConflictResolution,
} from './conflicts.js';
export {
  DependencyResolver,
  type PluginEntry,
  type ResolutionContext,
  type DetailedResolutionResult,
} from './resolver.js';

export { createDependencyResolver, quickResolve } from './resolver.utils.js';
