/**
 * Resolver de dependências com tipagem estrita
 */

import type { Result, PluginId, PluginName, Version } from '../../shared/types';
import type {
  DependencyGraph,
  DependencyConflict,
  ResolutionResult,
  ResolutionContext,
  DependencyAnalysis,
} from '../../domain/dependency';
import { DependencyError, ConflictType } from '../../domain/dependency';
import { success, failure } from '../../shared/types';
import { createPluginId } from '../../shared/types/common.types.js';

/**
 * Configuração do resolver
 */
export interface DependencyResolverConfig {
  readonly maxDepth: number;
  readonly timeout: number;
  readonly strictVersioning: boolean;
  readonly allowCircularDependencies: boolean;
}

/**
 * Nó de dependência interno
 */
interface InternalDependencyNode {
  readonly id: PluginId;
  readonly name: PluginName;
  readonly version: Version;
  readonly dependencies: readonly PluginId[];
  readonly dependents: readonly PluginId[];
  readonly visited: boolean;
  readonly depth: number;
}

/**
 * Resolver de dependências
 */
export class DependencyResolver {
  private readonly config: DependencyResolverConfig;
  private readonly nodes = new Map<PluginId, InternalDependencyNode>();
  private readonly edges = new Map<PluginId, readonly PluginId[]>();

  constructor(config: DependencyResolverConfig) {
    this.config = config;
  }

  /**
   * Adiciona um plugin ao grafo
   */
  addPlugin(
    id: PluginId,
    name: PluginName,
    version: Version,
    dependencies: readonly PluginId[] = []
  ): Result<void, DependencyError> {
    if (this.nodes.has(id)) {
      return failure(
        new DependencyError(
          ConflictType.DUPLICATE_DEPENDENCY,
          undefined,
          `Plugin ${id} already exists`
        )
      );
    }

    const node: InternalDependencyNode = {
      id,
      name,
      version,
      dependencies,
      dependents: [],
      visited: false,
      depth: 0,
    };

    this.nodes.set(id, node);
    this.edges.set(id, dependencies);

    return success(undefined);
  }

  /**
   * Resolve a ordem de carregamento
   */
  resolve(context: ResolutionContext): Result<ResolutionResult, DependencyError> {
    try {
      const analysis = this.analyzeGraph();

      if (!analysis.success) {
        return failure(analysis.error!);
      }

      const conflicts = this.detectConflicts(analysis.data!);

      if (conflicts.length > 0 && context.strictVersioning) {
        return failure(
          new DependencyError(
            ConflictType.VERSION_MISMATCH,
            undefined,
            'Version conflicts detected'
          )
        );
      }

      const order = this.calculateLoadOrder(analysis.data!);

      if (!order.success) {
        return failure(order.error!);
      }

      const result: ResolutionResult = {
        success: true,
        order: order.data!,
        conflicts,
        summary: this.generateSummary(order.data!, conflicts),
      };

      return success(result);
    } catch (error) {
      return failure(
        new DependencyError(
          ConflictType.MISSING_DEPENDENCY,
          undefined,
          `Resolution failed: ${error}`
        )
      );
    }
  }

  /**
   * Analisa o grafo de dependências
   */
  private analyzeGraph(): Result<DependencyAnalysis, DependencyError> {
    const cycles = this.detectCycles();

    if (cycles.length > 0 && !this.config.allowCircularDependencies) {
      return failure(
        new DependencyError(
          ConflictType.CIRCULAR_DEPENDENCY,
          { cycle: cycles[0].map(createPluginId) },
          'Circular dependency detected'
        )
      );
    }

    const graph: DependencyGraph = {
      nodes: new Map(
        Array.from(this.nodes.entries()).map(([id, node]) => [
          id,
          {
            name: node.name,
            version: node.version,
            dependencies: Array.from(node.dependencies).map(dep => dep as string),
            dependents: Array.from(node.dependents).map(dep => dep as string),
            depth: node.depth,
          },
        ])
      ),
      edges: new Map(
        Array.from(this.edges.entries()).map(([key, value]) => [key, value.map(v => v as string)])
      ),
      cycles,
    };

    const analysis: DependencyAnalysis = {
      graph,
      conflicts: [],
      resolutionOrder: [],
      statistics: {
        totalPlugins: this.nodes.size,
        totalDependencies: Array.from(this.edges.values()).reduce(
          (sum, deps) => sum + deps.length,
          0
        ),
        maxDepth: Math.max(...Array.from(this.nodes.values()).map(n => n.depth)),
        cycleCount: cycles.length,
      },
    };

    return success(analysis);
  }

  /**
   * Detecta ciclos no grafo
   */
  private detectCycles(): readonly string[][] {
    const cycles: string[][] = [];
    const visited = new Set<PluginId>();
    const recursionStack = new Set<PluginId>();

    for (const [nodeId] of Array.from(this.nodes)) {
      if (!visited.has(nodeId)) {
        this.dfsForCycles(nodeId, visited, recursionStack, [], cycles);
      }
    }

    return cycles;
  }

  /**
   * DFS para detecção de ciclos
   */
  private dfsForCycles(
    nodeId: PluginId,
    visited: Set<PluginId>,
    recursionStack: Set<PluginId>,
    path: string[],
    cycles: string[][]
  ): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const dependencies = this.edges.get(nodeId) || [];

    for (const depId of dependencies) {
      if (!visited.has(depId)) {
        this.dfsForCycles(depId, visited, recursionStack, path, cycles);
      } else if (recursionStack.has(depId)) {
        const cycleStart = path.indexOf(depId);
        cycles.push(path.slice(cycleStart));
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
  }

  /**
   * Detecta conflitos de dependência
   */
  private detectConflicts(analysis: DependencyAnalysis): readonly DependencyConflict[] {
    const conflicts: DependencyConflict[] = [];

    // Implementação simplificada - pode ser expandida
    for (const cycle of analysis.graph.cycles) {
      conflicts.push({
        type: ConflictType.CIRCULAR_DEPENDENCY,
        pluginId: createPluginId(cycle[0] || 'unknown'),
        dependencyId: createPluginId(cycle[1] || 'unknown'),
        description: `Circular dependency detected: ${cycle.join(' -> ')}`,
        severity: 'error' as const,
        suggestedResolution: 'Remove circular dependencies or enable allowCircularDependencies',
        conflictingPlugins: cycle.map(id => createPluginId(id)),
        details: { cycle: cycle.map(id => createPluginId(id)) },
      });
    }

    return conflicts;
  }

  /**
   * Calcula a ordem de carregamento
   */
  private calculateLoadOrder(
    analysis: DependencyAnalysis
  ): Result<readonly string[], DependencyError> {
    const order: string[] = [];
    const visited = new Set<PluginId>();
    const temporary = new Set<PluginId>();

    for (const [nodeId] of analysis.graph.nodes) {
      const pluginId = createPluginId(nodeId);
      if (!visited.has(pluginId)) {
        const result = this.topologicalSort(pluginId, visited, temporary, order, analysis.graph);
        if (!result.success) {
          return result;
        }
      }
    }

    return success(order.reverse());
  }

  /**
   * Ordenação topológica
   */
  private topologicalSort(
    nodeId: PluginId,
    visited: Set<PluginId>,
    temporary: Set<PluginId>,
    order: string[],
    graph: DependencyGraph
  ): Result<void, DependencyError> {
    if (temporary.has(nodeId)) {
      return failure(
        new DependencyError(
          ConflictType.CIRCULAR_DEPENDENCY,
          undefined,
          'Circular dependency in topological sort'
        )
      );
    }

    if (visited.has(nodeId)) {
      return success(undefined);
    }

    temporary.add(nodeId);

    const dependencies = graph.edges.get(nodeId as string) || [];
    for (const depId of dependencies) {
      const result = this.topologicalSort(createPluginId(depId), visited, temporary, order, graph);
      if (!result.success) {
        return result;
      }
    }

    temporary.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId as string);

    return success(undefined);
  }

  /**
   * Gera resumo da resolução
   */
  private generateSummary(
    order: readonly string[],
    conflicts: readonly DependencyConflict[]
  ): string {
    const pluginCount = order.length;
    const conflictCount = conflicts.length;

    return `Resolved ${pluginCount} plugins with ${conflictCount} conflicts`;
  }
}
