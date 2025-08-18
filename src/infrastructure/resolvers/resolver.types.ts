/**
 * @file Type definitions for the dependency resolver.
 */

import type { Plugin, PluginRegistrationOptions } from '../../domain/plugin/plugin.types.js';
import type { KernelConfig } from '../../domain/kernel/kernel.types.js';
import type { ResolutionResult } from '../../domain/dependency/dependency.types.js';
import type { DependencyGraph } from './graph.js';
import type { VersionResolution } from './version.js';
import type { ConflictResolutionStrategy } from './conflicts.js';

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
