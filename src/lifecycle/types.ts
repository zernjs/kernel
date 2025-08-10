import type { PluginInstance } from '@types';

export type LifecyclePhase =
  | 'beforeInit'
  | 'init'
  | 'afterInit'
  | 'beforeDestroy'
  | 'destroy'
  | 'afterDestroy';

export interface PhasePolicy {
  timeoutMs?: number;
  retry?: number;
}

export type LifecyclePolicies = Partial<Record<LifecyclePhase, PhasePolicy>>;

export type PhaseFn = (plugin: PluginInstance, kernel: unknown) => Promise<void>;

export interface LifecycleEngineOptions {
  concurrency?: number; // níveis topológicos nas próximas fases
  policies?: LifecyclePolicies;
}

export type Handler<T> = (payload: T) => void | Promise<void>;

export interface LifecycleEventMap {
  pluginLoaded: { name: string };
  pluginFailed: { name: string; error: unknown };
}
