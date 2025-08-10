// Kernel configuration
import type { ConflictPolicy, EventAdapter, RxjsSubjectLike } from '@types';

export type PluginState = 'unloaded' | 'loading' | 'loaded' | 'error' | 'destroyed';

export interface PluginInstance {
  metadata: { name: string; version: string; description?: string };
  // setup binder symbol added by definePlugin
  [key: symbol]: unknown;
}

export interface PluginLoadOrder {
  before?: string[];
  after?: string[];
}

// Names and maps
export type PluginName = string;
export type PluginMap = Record<PluginName, PluginInstance>;

// Common order type for builder.use
export type UseOrder = { before?: string[]; after?: string[] };

// Registry interface to decouple implementation
export interface IPluginRegistry {
  register(plugin: PluginInstance, order?: PluginLoadOrder): void;
  get<T extends PluginInstance = PluginInstance>(name: string): T | null;
  has(name: string): boolean;
  list(): PluginInstance[];
  getLoadOrder(name: string): PluginLoadOrder | undefined;
  clear(): void;
}

// Accessor type for typed plugin access on Kernel
export type PluginAccessor<TPlugins extends object> = {
  readonly [K in keyof TPlugins]: TPlugins[K];
} & {
  get<K extends keyof TPlugins & string>(name: K): TPlugins[K] | null;
  register(plugin: PluginInstance, order?: PluginLoadOrder): void;
  has(name: string): boolean;
  list(): PluginInstance[];
  getLoadOrder(name: string): PluginLoadOrder | undefined;
  clear(): void;
};

// Type utilities for compile-time augmentation merging
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

export interface EventsOptions {
  adapters?: Array<'node' | EventAdapter>;
  rxjs?: { subjectFactory: (namespace: string, eventName: string) => RxjsSubjectLike<unknown> };
}

export interface KernelOptions {
  events?: EventsOptions;
  augmentations?: {
    policy?: ConflictPolicy;
    namespacePrefix?: string;
  };
}

// Plugin-declared specs (used by Kernel during init)
export interface DeclaredHooks {
  hooks?: Record<string, { on: unknown; off: unknown; emit: unknown; once: unknown }>;
}

export interface DeclaredEvents {
  events?: { namespace: string; spec: Record<string, { __type: 'event-def'; options?: unknown }> };
}

export interface DeclaredErrors {
  errors?: { namespace: string; kinds: readonly string[] };
}

export interface DeclaredAlerts {
  alerts?: { namespace: string; kinds: readonly string[] };
}

export interface DeclaredAugments {
  augments?: Partial<Record<string, Record<string, unknown>>>;
}

// Central symbol used to access plugin setup binder
export const PLUGIN_SETUP_SYMBOL = Symbol.for('zern.plugin.setup');
