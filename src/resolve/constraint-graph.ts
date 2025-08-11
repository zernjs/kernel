/**
 * @file Directed graph to model plugin ordering constraints.
 */
import type { Edge, EdgeType, NodeName } from '@types';

export class ConstraintGraph {
  private readonly nodeSet = new Set<NodeName>();
  private readonly outgoingMap = new Map<NodeName, Edge[]>();
  private readonly incomingCountMap = new Map<NodeName, number>();

  addNode(name: NodeName): void {
    if (this.nodeSet.has(name)) return;
    this.nodeSet.add(name);
    this.outgoingMap.set(name, []);
    this.incomingCountMap.set(name, 0);
  }

  addEdge(from: NodeName, to: NodeName, type: EdgeType): void {
    if (from === to) return;
    this.addNode(from);
    this.addNode(to);
    const edge: Edge = { from, to, type, weight: this.computeEdgeWeight(type) };
    this.addOutgoingEdge(from, edge);
    this.incomingCountMap.set(to, (this.incomingCountMap.get(to) ?? 0) + 1);
  }

  getNodes(): NodeName[] {
    return Array.from(this.nodeSet);
  }

  getOutgoing(name: NodeName): Edge[] {
    return this.outgoingMap.get(name) ?? [];
  }

  getIncomingCount(name: NodeName): number {
    return this.incomingCountMap.get(name) ?? 0;
  }

  decrementIncoming(name: NodeName): void {
    const curr = this.incomingCountMap.get(name) ?? 0;
    this.incomingCountMap.set(name, Math.max(0, curr - 1));
  }

  private addOutgoingEdge(from: NodeName, edge: Edge): void {
    const list = this.outgoingMap.get(from);
    if (list) list.push(edge);
  }

  private computeEdgeWeight(type: EdgeType): number {
    return type === 'dep' ? 3 : type === 'user' ? 2 : 1;
  }
}
