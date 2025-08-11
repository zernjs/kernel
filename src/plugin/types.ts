/**
 * @file Public types for the Plugin layer.
 */

/** -------------------------
 * Domain types (stable codes)
 * ------------------------- */
export type ConflictPolicy = 'error' | 'override' | 'namespace';

/** -------------------------
 * Public API types
 * ------------------------- */
export interface AugmentationOptions {
  policy?: ConflictPolicy;
  namespacePrefix?: string;
}

import type { PluginOptionsSpec } from './options';
import type { Kernel } from '../core/kernel';
import type { TypedEvents } from '../events/types';
import type { PluginInstance } from '../core/types';
import type { HookBus } from '../hooks/hook-bus';
import type { EventBus } from '../events/event-bus';
import type { EventDef } from '../events/types';
import type { ErrorBus } from '../errors/error-bus';
import type { AlertBus } from '../alerts/alert-bus';

export interface PluginSpec<
  Name extends string = string,
  API extends object = object,
  Deps extends readonly DepItem[] = readonly DepItem[],
  Aug extends Record<string, object> = Record<string, object>,
> {
  name: Name;
  version: string;
  description?: string;
  options?: PluginOptionsSpec | undefined;
  dependsOn?: Deps;
  loadBefore?: readonly string[];
  loadAfter?: readonly string[];
  hooks?: Record<string, { on: unknown; off: unknown; emit: unknown; once: unknown }>;
  events?: { namespace: string; spec: Record<string, EventDef> };
  errors?: { namespace: string; kinds: readonly string[] };
  alerts?: { namespace: string; kinds: readonly string[] };
  augments?: Aug;
  setup(ctx: SetupContext<NonNullable<Deps>>, options?: unknown): API | Promise<API>;
}

export type PluginCtor<
  Name extends string,
  API extends object,
  Aug extends Record<string, object> = Record<string, object>,
  Evt extends { namespace: string; spec: Record<string, EventDef> } | undefined = undefined,
> = new () => PluginInstance & {
  metadata: { name: Name; version: string; description?: string };
  augments?: Aug;
} & API &
  (Evt extends undefined ? object : { events: Evt });

export type PlainDep = PluginCtor<string, object>;
export type DetailedDep = {
  plugin: PluginCtor<string, object>;
  version?: string;
  optional?: boolean;
};
export type DepItem = PlainDep | DetailedDep;

/** -------------------------
 * Typed ctx helpers (dependencies → plugins map)
 * ------------------------- */
type ExtractCtor<D> = D extends { plugin: infer C } ? C : D;

type DepsToPluginMap<Deps extends readonly DepItem[]> = Deps extends readonly []
  ? Record<string, never>
  : {
      [C in ExtractCtor<Deps[number]> as InstanceType<C> extends PluginInstance
        ? InstanceType<C>['metadata']['name'] & string
        : never]: InstanceType<C> extends PluginInstance
        ? Omit<InstanceType<C>, 'metadata'>
        : never;
    };

export type DependenciesContext<Deps extends readonly DepItem[]> = {
  plugins: DepsToPluginMap<Deps>;
};

export interface BaseSetupContext {
  kernel: Kernel<Record<string, PluginInstance>>;
  hooks: HookBus;
  events: EventBus & TypedEvents<Record<string, Record<string, EventDef>>>;
  errors: ErrorBus;
  alerts: AlertBus;
  extend?: (target: string, api: Record<string, unknown>) => void;
}

export type SetupContext<Deps extends readonly DepItem[]> = BaseSetupContext &
  DependenciesContext<Deps> & {
    use: <K extends keyof DepsToPluginMap<Deps> & string>(name: K) => DepsToPluginMap<Deps>[K];
  };

/** Public alias for DX; default keeps it generic. */
export type ZKernelContext<Deps extends readonly DepItem[] = readonly DepItem[]> =
  SetupContext<Deps>;

/** Helper type used to give contextual typing to `definePlugin`. */
export type InferablePluginSpec<
  Name extends string,
  Deps extends readonly DepItem[],
  Aug extends Record<string, object>,
  API extends object,
> = Omit<PluginSpec<Name, API, Deps, Aug>, 'setup'> & {
  setup(ctx: SetupContext<NonNullable<Deps>>, options?: unknown): API | Promise<API>;
};

/**
 * Extracts an event namespace→spec map from a Plugin instance type.
 */
export type ExtractEvents<T> = T extends { events?: { namespace: infer N; spec: infer S } }
  ? N extends string
    ? S extends Record<string, EventDef>
      ? { [K in N]: S }
      : Record<string, never>
    : Record<string, never>
  : Record<string, never>;
