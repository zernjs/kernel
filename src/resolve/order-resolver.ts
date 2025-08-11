/**
 * @file Resolves plugin load order using constraints from deps, user rules and hints.
 */
import { ConstraintGraph, stableTopologicalSort } from '@resolver';
import { SemverValidator, tryCatch } from '@utils';
import {
  dependencyMissing,
  dependencyVersionUnsatisfied,
  KernelError,
  invalidVersionSpec,
} from '@errors';
import type { ResolveInput, PluginInstance, PreferFn, UserOrderMap } from '@types';

export function resolvePluginOrder(input: ResolveInput): PluginInstance[] {
  const { plugins, userOrder } = input;
  const { graph, byName } = buildInitialGraph(plugins);

  addDependencyEdges(graph, plugins, byName);
  addUserOrderEdges(graph, userOrder);
  addHintEdges(graph, plugins);

  const prefer = computePrefer(plugins);
  const orderedNames = sortOrThrow(graph, prefer);
  const ordered = mapOrderedNames(orderedNames, byName);

  validateDependenciesAndVersions(plugins, byName);

  return ordered;
}

function buildInitialGraph(plugins: PluginInstance[]): {
  graph: ConstraintGraph;
  byName: Map<string, PluginInstance>;
} {
  const graph = new ConstraintGraph();
  const byName = new Map(plugins.map(p => [p.metadata.name, p] as const));
  for (const p of plugins) graph.addNode(p.metadata.name);
  return { graph, byName };
}

function addDependencyEdges(
  graph: ConstraintGraph,
  plugins: PluginInstance[],
  byName: Map<string, PluginInstance>
): void {
  for (const p of plugins) {
    const ctor = (p as unknown as { constructor: { dependsOn?: Array<new () => PluginInstance> } })
      .constructor;
    const deps: Array<new () => PluginInstance> = ctor.dependsOn ?? [];
    for (const depCtor of deps) {
      const dep = new depCtor();
      if (!byName.has(dep.metadata.name)) continue; // missing deps validated later
      graph.addEdge(dep.metadata.name, p.metadata.name, 'dep');
    }
  }
}

function addUserOrderEdges(graph: ConstraintGraph, userOrder: UserOrderMap): void {
  for (const [name, cfg] of Object.entries(userOrder)) {
    if (!cfg) continue;
    for (const b of cfg.before ?? []) graph.addEdge(name, b, 'user');
    for (const a of cfg.after ?? []) graph.addEdge(a, name, 'user');
  }
}

function addHintEdges(graph: ConstraintGraph, plugins: PluginInstance[]): void {
  for (const p of plugins) {
    const meta = p.metadata as { loadBefore?: string[]; loadAfter?: string[] };
    const hintBefore = meta.loadBefore;
    const hintAfter = meta.loadAfter;
    for (const b of hintBefore ?? []) graph.addEdge(p.metadata.name, b, 'hint');
    for (const a of hintAfter ?? []) graph.addEdge(a, p.metadata.name, 'hint');
  }
}

function computePrefer(plugins: PluginInstance[]): PreferFn {
  const nameToIndex = new Map<string, number>();
  plugins.forEach((p, i) => nameToIndex.set(p.metadata.name, i));
  return (a: string, b: string): number => nameToIndex.get(a)! - nameToIndex.get(b)!;
}

function sortOrThrow(graph: ConstraintGraph, prefer: PreferFn): string[] {
  const sortedRes = tryCatch(() => stableTopologicalSort(graph, prefer));
  if (!sortedRes.ok) {
    const err = sortedRes.error as Error;
    throw new KernelError('DependencyCycle', err.message, { cause: err });
  }
  return sortedRes.value;
}

function mapOrderedNames(
  orderedNames: string[],
  byName: Map<string, PluginInstance>
): PluginInstance[] {
  return orderedNames.map(n => byName.get(n)!).filter(Boolean);
}

function validateDependenciesAndVersions(
  plugins: PluginInstance[],
  byName: Map<string, PluginInstance>
): void {
  for (const p of plugins) {
    const declared = (
      p.metadata as { dependencies?: Array<{ name: string; version?: string; optional?: boolean }> }
    ).dependencies;
    if (!declared) continue;

    for (const d of declared) {
      const dep = byName.get(d.name);

      if (!dep) {
        if (!d.optional) throw dependencyMissing(p.metadata.name, d.name);
        continue;
      }

      if (!d.version) continue;

      const okTry = tryCatch(() => SemverValidator.satisfies(dep.metadata.version, d.version!));
      if (!okTry.ok) {
        // refine error shapes when parsing fails for either side
        try {
          SemverValidator.parse(dep.metadata.version);
        } catch {
          throw invalidVersionSpec(p.metadata.name, d.name, dep.metadata.version, 'actual');
        }
        const cleaned = d.version.replace(/^[~^>=]*/, '');
        try {
          SemverValidator.parse(cleaned);
        } catch {
          throw invalidVersionSpec(p.metadata.name, d.name, d.version, 'range');
        }
        throw okTry.error as Error;
      }

      const ok = okTry.value;
      if (!ok) {
        throw dependencyVersionUnsatisfied(
          p.metadata.name,
          d.name,
          d.version,
          dep.metadata.version
        );
      }
    }
  }
}
