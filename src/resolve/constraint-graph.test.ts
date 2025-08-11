/**
 * @file Unit tests for ConstraintGraph.
 */
import { describe, it, expect } from 'vitest';
import { ConstraintGraph } from '@resolver/constraint-graph';

describe('ConstraintGraph', () => {
  it('adds nodes and edges; computes incoming and outgoing', () => {
    const g = new ConstraintGraph();
    g.addNode('A');
    g.addEdge('A', 'B', 'dep');
    g.addEdge('A', 'C', 'user');
    g.addEdge('C', 'D', 'hint');

    expect(g.getNodes().sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(
      g
        .getOutgoing('A')
        .map(e => e.to)
        .sort()
    ).toEqual(['B', 'C']);
    expect(g.getIncomingCount('B')).toBe(1);
    expect(g.getIncomingCount('D')).toBe(1);

    g.decrementIncoming('B');
    expect(g.getIncomingCount('B')).toBe(0);
  });

  it('ignores self-edges', () => {
    const g = new ConstraintGraph();
    g.addEdge('X', 'X', 'dep');
    expect(g.getOutgoing('X')).toEqual([]);
    expect(g.getIncomingCount('X')).toBe(0);
  });
});
