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
import type { PluginInstance } from '../core/types';
import type { ErrorBus } from '../errors/error-bus';
import type { DefinedErrors, ErrorDef } from '../errors/types';

export interface PluginSpec<
  Name extends string = string,
  API extends object = object,
  Deps extends readonly DepItem[] = readonly DepItem[],
  Aug extends Record<string, object> = Record<string, object>,
  Errs = undefined,
> {
  name: Name;
  version: string;
  description?: string;
  options?: PluginOptionsSpec | undefined;
  dependsOn?: Deps;
  loadBefore?: readonly string[];
  loadAfter?: readonly string[];
  /**
   * Aceita o valor retornado por defineErrors(namespace, spec), sem restringir aqui.
   * O tipo real é extraído por ExtractErrors<T> abaixo.
   */
  errors?: Errs;
  augments?: Aug;
  setup(ctx: SetupContext<NonNullable<Deps>>, options?: unknown): API | Promise<API>;
}

/**
 * Plugin constructor type that carries metadata, API, augments and optional errors.
 * Including `errors` aqui é essencial para ExtractErrors<InstanceType<Ctor>> funcionar.
 */
export type PluginCtor<
  Name extends string,
  API extends object,
  Aug extends Record<string, object> = Record<string, object>,
  Errs = undefined,
> = new () => PluginInstance & {
  metadata: { name: Name; version: string; description?: string };
  augments?: Aug;
} & API &
  (Errs extends unknown ? (Errs extends undefined ? object : { errors: Errs }) : object);

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
  errors: ErrorBus;
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
  Errs = undefined,
> = Omit<PluginSpec<Name, API, Deps, Aug, Errs>, 'setup'> & {
  setup(ctx: SetupContext<NonNullable<Deps>>, options?: unknown): API | Promise<API>;
};

/**
 * Extrai o mapa namespace→kinds a partir de errors definido por defineErrors(namespace, spec).
 */
export type ExtractErrors<T> = T extends {
  errors?: DefinedErrors<infer Spec, infer N>;
}
  ? N extends string
    ? Spec extends Record<string, unknown>
      ? { [K in N]: { [P in keyof Spec & string]: ErrorDef<Spec[P]> } }
      : Record<never, never>
    : Record<never, never>
  : Record<never, never>;
