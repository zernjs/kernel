/**
 * @file Dependency domain types - Core type definitions for dependency domain.
 * Contains all types related to plugin dependency management and resolution.
 */

import type { Version, PluginName, PluginId } from '../../shared/types/common.types.js';

/**
 * Version constraint operators.
 */
export type VersionOperator = '=' | '>=' | '>' | '<=' | '<' | '^' | '~' | '*';

/**
 * Version constraint definition.
 */
export interface VersionConstraint {
  readonly operator: VersionOperator;
  readonly version: Version;
  readonly prerelease?: boolean;
  readonly raw?: string;
}

/**
 * Load order constraint for plugin loading sequence.
 */
export interface LoadOrderConstraint {
  readonly before?: readonly PluginId[];
  readonly after?: readonly PluginId[];
  readonly priority?: number;
}

/**
 * Dependency conflict types.
 */
export enum ConflictType {
  VERSION_MISMATCH = 'version_mismatch',
  CIRCULAR_DEPENDENCY = 'circular_dependency',
  MISSING_DEPENDENCY = 'missing_dependency',
  DUPLICATE_DEPENDENCY = 'duplicate_dependency',
  LOAD_ORDER_CONFLICT = 'load_order_conflict',
  CONDITION_CONFLICT = 'condition_conflict',
}

/**
 * Dependency conflict definition.
 */
export interface DependencyConflict {
  readonly type: ConflictType;
  readonly pluginId: PluginId;
  readonly dependencyId: PluginId;
  readonly description: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly suggestedResolution?: string;
  readonly conflictingPlugins?: readonly PluginId[];
  readonly details?: {
    readonly required?: string;
    readonly found?: string;
    readonly cycle?: readonly PluginId[];
  };
}

/**
 * Resultado da resolução de dependências
 */
export interface ResolutionResult {
  readonly success: boolean;
  readonly order: readonly string[];
  readonly conflicts: readonly DependencyConflict[];
  readonly summary: string;
}

/**
 * Nó no grafo de dependências
 */
export interface DependencyNode {
  readonly name: PluginName;
  readonly version: Version;
  readonly dependencies: readonly string[];
  readonly dependents: readonly string[];
  readonly depth: number;
}

/**
 * Grafo de dependências
 */
export interface DependencyGraph {
  readonly nodes: ReadonlyMap<string, DependencyNode>;
  readonly edges: ReadonlyMap<string, readonly string[]>;
  readonly cycles: readonly string[][];
}

/**
 * Contexto de resolução
 */
export interface ResolutionContext {
  readonly strictVersioning: boolean;
  readonly allowCircularDependencies: boolean;
  readonly maxDepth: number;
  readonly timeout: number;
}

/**
 * Estratégia de resolução de conflitos
 */
export interface ConflictResolutionStrategy {
  readonly name: string;
  readonly priority: number;
  readonly canResolve: (conflict: DependencyConflict) => boolean;
  readonly resolve: (conflict: DependencyConflict, context: ResolutionContext) => ResolutionResult;
}

/**
 * Resultado da análise de dependências
 */
export interface DependencyAnalysis {
  readonly graph: DependencyGraph;
  readonly conflicts: readonly DependencyConflict[];
  readonly resolutionOrder: readonly string[];
  readonly statistics: {
    readonly totalPlugins: number;
    readonly totalDependencies: number;
    readonly maxDepth: number;
    readonly cycleCount: number;
  };
}

/**
 * Erro de dependência
 */
export class DependencyError extends Error {
  constructor(
    public readonly type: ConflictType,
    public readonly details: DependencyConflict['details'],
    message?: string
  ) {
    super(message || `Dependency error: ${type}`);
    this.name = 'DependencyError';
  }
}
