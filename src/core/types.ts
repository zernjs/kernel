/**
 * @file Public types for the Core layer.
 */

import type { ConflictPolicy } from '@types';
// events adapters removed from core options

/** -------------------------
 * Domain types (stable codes)
 * ------------------------- */
export type PluginState = 'unloaded' | 'loading' | 'loaded' | 'error' | 'destroyed';
export type PluginName = string;

/** -------------------------
 * Public API types
 * ------------------------- */
export interface PluginInstance {
  metadata: { name: string; version: string; description?: string };
  [key: symbol]: unknown;
}

export interface PluginLoadOrder {
  before?: string[];
  after?: string[];
}

export type UseOrder = { before?: string[]; after?: string[] };

/** Names and maps */
export type PluginMap = Record<PluginName, PluginInstance>;

/** Registry interface to decouple implementation */
export interface IPluginRegistry {
  register(plugin: PluginInstance, order?: PluginLoadOrder): void;
  get<T extends PluginInstance = PluginInstance>(name: string): T | null;
  has(name: string): boolean;
  list(): PluginInstance[];
  getLoadOrder(name: string): PluginLoadOrder | undefined;
  clear(): void;
}

/** Accessor type for typed plugin access on Kernel */
export type PluginAccessor<TPlugins extends object> = {
  readonly [K in keyof TPlugins]: TPlugins[K];
} & {
  register(plugin: PluginInstance, order?: PluginLoadOrder): void;
  has(name: string): boolean;
  list(): PluginInstance[];
  getLoadOrder(name: string): PluginLoadOrder | undefined;
  clear(): void;
};

/** -------------------------
 * Type utilities for compile-time augmentation merging
 * ------------------------- */
export type AugmentMap = Partial<Record<string, unknown>>;

export type ApplyAugmentsToPlugins<TPlugins extends object, TAug extends AugmentMap> = {
  [K in keyof TPlugins]: K extends keyof TAug
    ? TPlugins[K] & (TAug[K] extends object ? TAug[K] : unknown)
    : TPlugins[K];
};

export type ExtractAugments<T> = T extends { augments?: infer A }
  ? A extends Record<string, unknown>
    ? A
    : Record<never, unknown>
  : Record<never, unknown>;

/** -------------------------
 * Kernel options
 * ------------------------- */
// EventsOptions removed

export interface KernelOptions {
  augmentations?: {
    policy?: ConflictPolicy;
    namespacePrefix?: string;
  };
}

/** -------------------------
 * Plugin-declared specs (used by Kernel during init)
 * ------------------------- */
export interface DeclaredErrors {
  errors?: { namespace: string; kinds: readonly string[] };
}
// DeclaredHooks/DeclaredEvents/DeclaredAlerts removed from core

/** -------------------------
 * Symbols
 * ------------------------- */
export const PLUGIN_SETUP_SYMBOL = Symbol.for('zern.plugin.setup');
