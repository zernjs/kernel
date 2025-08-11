/**
 * @file Stable topological sort honoring a preference comparator.
 */
import type { ConstraintGraph } from '@resolver';
import type { Edge, PreferFn } from '@types';
import { tryCatch } from '@utils';

export function stableTopologicalSort(graph: ConstraintGraph, prefer: PreferFn): string[] {
  const result: string[] = [];
  const queue: string[] = [];
  const nodes = graph.getNodes();

  for (const n of nodes) {
    if (graph.getIncomingCount(n) === 0) queue.push(n);
  }
  queue.sort(prefer);

  const outgoingCache = new Map<string, Edge[]>();

  const getOutgoingCached = (n: string): Edge[] => {
    const cached = outgoingCache.get(n);
    if (cached) return cached;
    const call = tryCatch(() =>
      (graph as unknown as { getOutgoing(name: string): Edge[] }).getOutgoing(n)
    );
    if (!call.ok) throw call.error as Error;
    const edges = call.value;
    outgoingCache.set(n, edges);
    return edges;
  };

  while (queue.length > 0) {
    const n = queue.shift()!;
    result.push(n);

    const outgoing = getOutgoingCached(n);
    for (const e of outgoing) {
      graph.decrementIncoming(e.to);
      if (graph.getIncomingCount(e.to) === 0) {
        queue.push(e.to);
      }
    }
    queue.sort(prefer);
  }

  if (result.length !== nodes.length) {
    throw new Error('Cyclic dependency detected while sorting plugins');
  }

  return result;
}
