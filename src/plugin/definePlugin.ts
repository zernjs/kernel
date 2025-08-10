/* eslint-disable no-redeclare */
import type { DepItem, PlainDep, PluginCtor, PluginSpec, InferablePluginSpec } from '@types';
import { createPluginMetadata, isDetailed } from './descriptors';
import { PLUGIN_SETUP_SYMBOL } from '@types';

// Overload providing contextual typing for setup(ctx) based on dependsOn

export function definePlugin<
  const Name extends string,
  const Deps extends readonly DepItem[] = readonly DepItem[],
  const Aug extends Record<string, object> = Record<string, object>,
  API extends object = object,
>(spec: InferablePluginSpec<Name, Deps, Aug, API>): PluginCtor<Name, API, NonNullable<Aug>>;

export function definePlugin<
  const S extends PluginSpec<string, object, readonly DepItem[], Record<string, object>>,
>(spec: S): PluginCtor<S['name'], Awaited<ReturnType<S['setup']>>, NonNullable<S['augments']>> {
  const kSetup: typeof PLUGIN_SETUP_SYMBOL = PLUGIN_SETUP_SYMBOL;
  class P {
    public readonly metadata = createPluginMetadata(spec);
    // exposed for Kernel to call during init
    public readonly [kSetup] = spec.setup;
    public readonly hooks = spec.hooks;
    public readonly events = spec.events;
    public readonly errors = spec.errors;
    public readonly alerts = spec.alerts;
    public readonly augments = spec.augments;
    // static reference for declaration of deps (fase 1: declaração apenas)
    static readonly dependsOn: PlainDep[] = spec.dependsOn
      ? spec.dependsOn.map(d => (isDetailed(d) ? d.plugin : d))
      : [];
    // kernel chamará setup e anexará a API — implementação futura no core/kernel
  }
  return P as unknown as PluginCtor<
    S['name'],
    Awaited<ReturnType<S['setup']>>,
    NonNullable<S['augments']>
  >;
}
