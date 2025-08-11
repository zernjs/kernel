/**
 * @file Public types for the Resolver layer.
 */
import type { PluginInstance } from '@types';

/** -------------------------
 * Domain types (stable codes)
 * ------------------------- */
export type EdgeType = 'dep' | 'user' | 'hint';
export type NodeName = string;
export type EdgeWeight = number;

/** -------------------------
 * Public API types
 * ------------------------- */
export interface Edge {
  from: string;
  to: string;
  type: EdgeType;
  weight: EdgeWeight; // dep > user > hint
}

export interface UserOrderRule {
  before?: string[];
  after?: string[];
}

export type UserOrderMap = Record<string, UserOrderRule | undefined>;

export interface ResolveInput {
  plugins: PluginInstance[];
  userOrder: UserOrderMap;
}

/** -------------------------
 * Internal structures
 * ------------------------- */
export type PreferFn = (a: NodeName, b: NodeName) => number;
