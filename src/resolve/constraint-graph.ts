import type { Edge, EdgeType } from '@types';

export class ConstraintGraph {
  private readonly nodes = new Set<string>();
  private readonly outgoing = new Map<string, Edge[]>();
  private readonly incomingCount = new Map<string, number>();

  addNode(name: string): void {
    if (!this.nodes.has(name)) {
      this.nodes.add(name);
      this.outgoing.set(name, []);
      this.incomingCount.set(name, 0);
    }
  }

  addEdge(from: string, to: string, type: EdgeType): void {
    if (from === to) return;
    this.addNode(from);
    this.addNode(to);
    const weight = type === 'dep' ? 3 : type === 'user' ? 2 : 1;
    const edge: Edge = { from, to, type, weight };
    const list = this.outgoing.get(from);
    if (list) list.push(edge);
    this.incomingCount.set(to, (this.incomingCount.get(to) ?? 0) + 1);
  }

  getNodes(): string[] {
    return Array.from(this.nodes);
  }

  getOutgoing(name: string): Edge[] {
    return this.outgoing.get(name) ?? [];
  }

  getIncomingCount(name: string): number {
    return this.incomingCount.get(name) ?? 0;
  }

  decrementIncoming(name: string): void {
    const curr = this.incomingCount.get(name) ?? 0;
    this.incomingCount.set(name, Math.max(0, curr - 1));
  }
}
