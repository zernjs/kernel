import type { ConstraintGraph } from '@resolver';
import type { Edge } from '@types';
import { tryCatch } from '@utils';

export function stableTopologicalSort(
  graph: ConstraintGraph,
  prefer: (a: string, b: string) => number
): string[] {
  const result: string[] = [];
  const queue: string[] = [];
  const nodes = graph.getNodes();

  for (const n of nodes) {
    if (graph.getIncomingCount(n) === 0) queue.push(n);
  }
  // deterministic order
  queue.sort(prefer);

  const outgoingCache = new Map<string, Edge[]>();

  while (queue.length > 0) {
    const n = queue.shift()!;
    result.push(n);
    let outgoing = outgoingCache.get(n);
    if (!outgoing) {
      const call = tryCatch(() =>
        (graph as unknown as { getOutgoing(name: string): Edge[] }).getOutgoing(n)
      );
      if (!call.ok) throw call.error as Error;
      outgoing = call.value;
      outgoingCache.set(n, outgoing);
    }
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
