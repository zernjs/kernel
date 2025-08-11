/**
 * @file Public types for the Lifecycle layer.
 */

import type { PluginInstance } from '@types';

/** -------------------------
 * Domain types (stable codes)
 * ------------------------- */
export type LifecyclePhase =
  | 'beforeInit'
  | 'init'
  | 'afterInit'
  | 'beforeDestroy'
  | 'destroy'
  | 'afterDestroy';

export type LifecycleEventName = 'pluginLoaded' | 'pluginFailed';

/** -------------------------
 * Public API types
 * ------------------------- */
export interface PhasePolicy {
  timeoutMs?: number;
  retry?: number;
}

export type LifecyclePolicies = Partial<Record<LifecyclePhase, PhasePolicy>>;

export type PhaseFn = (plugin: PluginInstance, kernel: unknown) => Promise<void>;

export interface LifecycleEngineOptions {
  concurrency?: number;
  policies?: LifecyclePolicies;
}

/** Generic handler used by lifecycle events. */
export type Handler<T> = (payload: T) => void | Promise<void>;

/** -------------------------
 * Public lifecycle events
 * ------------------------- */
export interface LifecycleEventMap {
  pluginLoaded: { name: string };
  pluginFailed: { name: string; error: unknown };
}

/** -------------------------
 * Internal structures
 * ------------------------- */
export type PluginPhaseMethodName = keyof PluginInstance;
export type LifecycleHandlersMap = Partial<{
  [K in keyof LifecycleEventMap]: Handler<LifecycleEventMap[K]>[];
}>;
