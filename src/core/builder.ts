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

function instantiate<T extends PluginInstance>(pluginCtor: new () => T): T {
  return new pluginCtor();
}

export class KernelBuilder<
  TPlugins extends Record<string, PluginInstance> = Record<never, never>,
  TAugments extends Record<string, object> = Record<never, never>,
> {
  private readonly registry = new PluginRegistry();
  private options: KernelOptions | undefined;

  use<Ctor extends PluginCtor<string, object>>(
    pluginCtor: Ctor,
    order?: UseOrder
  ): KernelBuilder<
    TPlugins & { [K in InstanceType<Ctor>['metadata']['name']]: InstanceType<Ctor> },
    TAugments & ExtractAugments<InstanceType<Ctor>>
  > {
    const instance = instantiate(pluginCtor);
    this.registry.register(instance as unknown as PluginInstance, order);
    return this as unknown as KernelBuilder<
      TPlugins & { [K in InstanceType<Ctor>['metadata']['name']]: InstanceType<Ctor> },
      TAugments & ExtractAugments<InstanceType<Ctor>>
    >;
  }

  withOptions(options: KernelOptions): this {
    this.options = options;
    return this;
  }

  build(): Kernel<ApplyAugmentsToPlugins<TPlugins, TAugments>, TAugments> {
    return new Kernel<ApplyAugmentsToPlugins<TPlugins, TAugments>, TAugments>(
      this.registry,
      this.options
    );
  }
}
