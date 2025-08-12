/* eslint-disable no-redeclare */
/**
 * @file Plugin definition helper with contextual typing for setup(ctx).
 */
import type { DepItem, PlainDep, PluginCtor, PluginSpec, InferablePluginSpec } from '@types';
import { createPluginMetadata, isDetailed } from './descriptors';
import { PLUGIN_SETUP_SYMBOL } from '@types';

// Overload providing contextual typing for setup(ctx) based on dependsOn
export function definePlugin<
  const Name extends string,
  const Deps extends readonly DepItem[] = readonly DepItem[],
  const Aug extends Record<string, object> = Record<string, object>,
  API extends object = object,
  Errs = undefined,
>(
  spec: InferablePluginSpec<Name, Deps, Aug, API, Errs>
): PluginCtor<Name, API, NonNullable<Aug>, Errs>;

export function definePlugin<
  const Name extends string,
  API extends object,
  const Deps extends readonly DepItem[] = readonly DepItem[],
  const Aug extends Record<string, object> = Record<string, object>,
  Errs = undefined,
  S extends PluginSpec<Name, API, Deps, Aug, Errs> = PluginSpec<Name, API, Deps, Aug, Errs>,
>(
  spec: S
): PluginCtor<Name, Awaited<ReturnType<S['setup']>>, NonNullable<S['augments']>, S['errors']> {
  const kSetup: typeof PLUGIN_SETUP_SYMBOL = PLUGIN_SETUP_SYMBOL;
  const metaInput = spec as unknown as PluginSpec<Name, API>;

  // use uma classe nomeada p/ preservar o tipo no construtor (InstanceType)
  class ZernPluginImpl {
    public readonly metadata = createPluginMetadata(metaInput);
    public readonly [kSetup] = spec.setup;
    public readonly errors = spec.errors;
    public readonly augments = spec.augments;
    static readonly dependsOn: PlainDep[] = (spec.dependsOn
      ? spec.dependsOn.map(d => (isDetailed(d) ? d.plugin : d))
      : []) as PlainDep[];
  }

  // retorne o próprio construtor tipado
  return ZernPluginImpl as unknown as PluginCtor<
    Name,
    Awaited<ReturnType<S['setup']>>,
    NonNullable<S['augments']>,
    S['errors']
  >;
}
