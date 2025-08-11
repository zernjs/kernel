/**
 * @file Fluent builder for Kernel creation, plugin registration and options.
 */
import type {
  KernelOptions,
  PluginInstance,
  UseOrder,
  ApplyAugmentsToPlugins,
  ExtractAugments,
} from '@types';
import type { PluginCtor } from '@plugin/types';
import { Kernel } from '@core/kernel';
import { PluginRegistry } from '@core/registry';
import type { ExtractEvents, ExtractAlerts } from '@plugin/types';
import type { EventDef } from '@events/types';
import type { AlertDef } from '@alerts/types';

function instantiate<T extends PluginInstance>(pluginCtor: new () => T): T {
  return new pluginCtor();
}

export class KernelBuilder<
  TPlugins extends Record<string, PluginInstance> = Record<never, never>,
  TAugments extends Record<string, object> = Record<never, never>,
  TEventMap extends Record<string, Record<string, EventDef>> = Record<never, never>,
  TAlertMap extends Record<string, Record<string, AlertDef>> = Record<never, never>,
> {
  private readonly registry = new PluginRegistry();
  private options: KernelOptions | undefined;

  use<
    Ctor extends PluginCtor<
      string,
      object,
      Record<string, object>,
      { namespace: string; spec: Record<string, EventDef> } | undefined,
      { namespace: string; spec: Record<string, AlertDef> } | undefined
    >,
  >(
    pluginCtor: Ctor,
    order?: UseOrder
  ): KernelBuilder<
    TPlugins & { [K in InstanceType<Ctor>['metadata']['name']]: InstanceType<Ctor> },
    TAugments & ExtractAugments<InstanceType<Ctor>>,
    TEventMap & ExtractEvents<InstanceType<Ctor>>,
    TAlertMap & ExtractAlerts<InstanceType<Ctor>>
  > {
    const instance = instantiate(pluginCtor);
    this.registry.register(instance as unknown as PluginInstance, order);
    return this as unknown as KernelBuilder<
      TPlugins & { [K in InstanceType<Ctor>['metadata']['name']]: InstanceType<Ctor> },
      TAugments & ExtractAugments<InstanceType<Ctor>>,
      TEventMap & ExtractEvents<InstanceType<Ctor>>,
      TAlertMap & ExtractAlerts<InstanceType<Ctor>>
    >;
  }

  withOptions(options: KernelOptions): this {
    this.options = options;
    return this;
  }

  build(): Kernel<ApplyAugmentsToPlugins<TPlugins, TAugments>, TAugments, TEventMap, TAlertMap> {
    return new Kernel<ApplyAugmentsToPlugins<TPlugins, TAugments>, TAugments, TEventMap, TAlertMap>(
      this.registry,
      this.options
    );
  }
}
