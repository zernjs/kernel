/**
 * @file Unit tests for stableTopologicalSort.
 */
import { describe, it, expect } from 'vitest';
import { ConstraintGraph } from '@resolver/constraint-graph';
import { stableTopologicalSort } from '@resolver/topological-sort';
import type { PreferFn } from '@types';

function makeGraph(edges: Array<[string, string]>): ConstraintGraph {
  const g = new ConstraintGraph();
  const nodes = new Set<string>();
  for (const [a, b] of edges) {
    nodes.add(a);
    nodes.add(b);
    g.addEdge(a, b, 'dep');
  }
  for (const n of nodes) g.addNode(n);
  return g;
}

describe('stableTopologicalSort', () => {
  it('sorts acyclic graph honoring prefer comparator', () => {
    const g = makeGraph([
      ['A', 'C'],
      ['B', 'C'],
      ['C', 'D'],
    ]);
    const prefer: PreferFn = (a, b) => a.localeCompare(b);
    const order = stableTopologicalSort(g, prefer);
    expect(order).toEqual(['A', 'B', 'C', 'D']);
  });

  it('throws on cycle', () => {
    const g = makeGraph([
      ['A', 'B'],
      ['B', 'A'],
    ]);
    const prefer: PreferFn = (a, b) => a.localeCompare(b);
    expect(() => stableTopologicalSort(g, prefer)).toThrow(
      'Cyclic dependency detected while sorting plugins'
    );
  });
});
