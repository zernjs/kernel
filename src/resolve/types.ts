import type { PluginInstance } from '@types';

export type EdgeType = 'dep' | 'user' | 'hint';

export interface Edge {
  from: string;
  to: string;
  type: EdgeType;
  weight: number; // dep > user > hint
}

export interface ResolveInput {
  plugins: PluginInstance[];
  userOrder: Record<string, { before?: string[]; after?: string[] } | undefined>;
}
